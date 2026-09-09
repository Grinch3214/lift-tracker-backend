# LiftTracker Backend — Architecture

Бэкенд для [LiftTracker](../LiftTracker) — offline-first трекера тренировок. Этот документ описывает scope, модель данных и API для первой версии бэкенда (Cloud Sync + Auth, соответствует `v1.3` в `LiftTracker/docs/02-mvp.md`).

---

## 1. Роль бэкенда

**Бэкенд — это слой синхронизации поверх offline-first фронтенда, а не source of truth.**

Фронтенд как был, так и остаётся полностью рабочим без сети — вся логика хранится и мутируется локально (`localStorage` через `useStorage`, см. `LiftTracker/CLAUDE.md`). Бэкенд добавляется поверх этого как фоновая синхронизация между устройствами одного пользователя, а не как замена локального хранилища. Если бэкенд недоступен — приложение работает как раньше, просто без синка.

### Scope этой версии

Только то, что зафиксировано в `LiftTracker/docs/04-decisions.md` под Cloud Sync:

- Регистрация / вход (email+пароль и Google OAuth)
- Синхронизация `workouts` (приоритет 1)
- Синхронизация `customMuscleGroups` / `customExercises` (приоритет 2)
- Синхронизация `groupOrder` / `exerciseOrder` (приоритет 3)

**Явно вне scope этой версии** (см. roadmap фронта, `v1.4`/`v1.5`): AI Coach и прокси к AI-провайдеру, раздел «Замеры» (`Measurement`/`MeasurementType`/`ProgressPhoto`), Push Notifications.

---

## 2. Стек

- **NestJS** — фреймворк, структура модулей/контроллеров/сервисов из коробки.
- **PostgreSQL** — реляционная БД.
- **TypeORM** (`@nestjs/typeorm`) — ORM, сущности + миграции. Решение и обоснование — см. [DECISIONS.md](DECISIONS.md). SQL/JOIN/constraints/транзакции разбираются отдельно (практика вне проекта), сам проект пишется сразу через ORM.

---

## 3. Модель данных

### Важный момент: id генерируются на клиенте

Фронтенд создаёт `id` (UUID) в момент создания записи, ещё до какой-либо связи с сервером — `app/utils/id.ts#generateId()` (`crypto.randomUUID()` с fallback). Запись может прожить локально сколько угодно до первого синка.

**Следствие:** первичные ключи в таблицах, которые синхронизируются, — `UUID`, принимаемый от клиента, а не `SERIAL`/`gen_random_uuid()` со стороны сервера. Сервер не генерирует эти id сам, только принимает и хранит.

### DDL

```sql
-- Пользователи
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- генерируется сервером — до регистрации id не существует
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,      -- NULL, если пользователь пришёл только через Google OAuth
  google_id TEXT UNIQUE,   -- NULL, если Google не привязан
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_has_auth_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- Refresh-токены — отдельная таблица, чтобы можно было отзывать конкретную сессию (logout),
-- а не только ждать истечения срока действия
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,   -- хранится хэш, не сам токен — как пароль
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Тренировки. Одна запись = один день (см. Workout во фронте — getOrCreateWorkoutByDate).
CREATE TABLE workouts (
  id UUID PRIMARY KEY,      -- приходит от клиента
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- используется для LWW при синке, см. раздел 5
  UNIQUE (user_id, date)    -- то же правило, что и локально: один Workout на дату
);
CREATE INDEX idx_workouts_user_id ON workouts(user_id);

-- Упражнение внутри конкретной тренировки (WorkoutExercise во фронте)
CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY,      -- приходит от клиента
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,   -- ссылка в каталог (статичный или custom_exercises) — НЕ внешний ключ в БД,
                                -- т.к. статичный каталог (app/data/muscle-groups.ts) в базе не хранится
  "order" INTEGER
);
CREATE INDEX idx_workout_exercises_workout_id ON workout_exercises(workout_id);

-- Один подход (SetEntry во фронте)
CREATE TABLE set_entries (
  id UUID PRIMARY KEY,      -- приходит от клиента
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  weight NUMERIC,               -- кг, только для trackingType 'weight-reps'
  reps INTEGER,
  duration_seconds INTEGER,     -- только для trackingType 'time-distance'
  distance_km NUMERIC,
  dumbbell_count SMALLINT CHECK (dumbbell_count IS NULL OR dumbbell_count IN (1, 2)),
  is_completed BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_set_entries_workout_exercise_id ON set_entries(workout_exercise_id);

-- Пользовательские группы мышц (MuscleGroup c isCustom=true во фронте)
CREATE TABLE custom_muscle_groups (
  id UUID PRIMARY KEY,      -- приходит от клиента
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,  -- soft-delete, как и локально — старые тренировки должны
                                               -- продолжать резолвить название
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_muscle_groups_user_id ON custom_muscle_groups(user_id);

-- Пользовательские упражнения (Exercise c isCustom=true во фронте)
CREATE TABLE custom_exercises (
  id UUID PRIMARY KEY,      -- приходит от клиента
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muscle_group_id TEXT NOT NULL,  -- может указывать на встроенную группу (не в БД) или на custom_muscle_groups.id —
                                   -- по той же причине не внешний ключ
  name TEXT NOT NULL,
  equipment TEXT,
  tracking_type TEXT NOT NULL CHECK (tracking_type IN ('weight-reps', 'time-distance')),
  "order" INTEGER,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_exercises_user_id ON custom_exercises(user_id);

-- Порядок drag-and-drop в пикере (catalogStore.groupOrder / exerciseOrder во фронте).
-- Один ряд на пользователя, а не отдельная таблица — это просто списки id, а не самостоятельные сущности.
CREATE TABLE catalog_order (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  group_order JSONB NOT NULL DEFAULT '[]',       -- string[]
  exercise_order JSONB NOT NULL DEFAULT '{}',    -- { [muscleGroupId: string]: string[] }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Почему `catalog_order` — JSONB, а не нормализованная таблица

`groupOrder`/`exerciseOrder` — это просто упорядоченные списки id, не самостоятельные сущности со своим жизненным циклом (в отличие от `workouts` или `custom_exercises`). Нормализация (таблица `id, user_id, muscle_group_id, exercise_id, position`) была бы технически «правильнее», но это самый низкоприоритетный кусок синхронизации (приоритет 3 — «дёшево добавить заодно, не критично само по себе»), и JSONB читается/пишется одним запросом целиком, ровно как использует его фронтенд (`applyOrder()` в `app/utils/exercises.ts`). Пересмотреть, если появится сценарий, где нужен доступ к порядку отдельной группы без вытягивания всего документа.

### Транзакции

Запись одной тренировки затрагивает 3 таблицы разом (`workouts` → `workout_exercises` → `set_entries`) — это должно быть атомарно, иначе можно получить `workout_exercises` без родительского `workout`, если что-то оборвётся посередине:

```sql
BEGIN;
INSERT INTO workouts (id, user_id, date, created_at, updated_at) VALUES (...);
INSERT INTO workout_exercises (id, workout_id, exercise_id, "order") VALUES (...);
INSERT INTO set_entries (id, workout_exercise_id, weight, reps, is_completed) VALUES (...);
COMMIT;
```

При синке всей тренировки целиком (см. раздел 5) проще всего удалить старые `workout_exercises`/`set_entries` этого `workout_id` и вставить заново, тоже в одной транзакции — не пытаться дифф­ать построчно.

---

## 4. Auth

Оба способа входа сразу: email+пароль и Google OAuth. Пароль хранится хэшированным (bcrypt/argon2 — выбрать при реализации), сам пароль в базе никогда не хранится.

**JWT:** access-токен (короткоживущий, например 15 минут) + refresh-токен (долгоживущий, например 30 дней, хранится в `refresh_tokens` как хэш — позволяет отозвать конкретную сессию через `/auth/logout`, а не просто ждать истечения срока).

### Эндпоинты

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `201 { accessToken, refreshToken, user }` |
| POST | `/auth/login` | `{ email, password }` | `200 { accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` (ротация refresh-токена) |
| POST | `/auth/logout` | `{ refreshToken }` | `204` (отзывает конкретный refresh-токен) |
| GET | `/auth/google` ⏸ | — | редирект на Google consent screen |
| GET | `/auth/google/callback` ⏸ | `?code=...` (от Google) | создаёт/находит `users` по `google_id`, выдаёт `{ accessToken, refreshToken, user }` |

⏸ — **не реализовано, отложено.** Email+пароль — приоритет текущей версии; см. раздел 7. `API.md` (эндпоинт-референс для интеграции с фронтом) намеренно не включает эти два — там только то, что реально есть.

Если пользователь регистрировался через email, а потом впервые логинится через Google с тем же email (или наоборот) — открытый вопрос, см. раздел 7.

---

## 5. Sync API

### Стратегия: Last-Write-Wins по `updated_at`, гранулярность — целый `Workout`

Конфликт возможен, если один и тот же день отредактирован на двух устройствах до того, как оба успели синхронизироваться. При синке сервер сравнивает `updated_at` пришедшей записи с тем, что уже есть в БД:

- пришедшая новее → перезаписывает (весь `Workout` со всеми `workout_exercises`/`set_entries`);
- пришедшая старее или равна → игнорируется, клиенту возвращается актуальная серверная версия.

Та же логика применяется к `custom_muscle_groups`/`custom_exercises`/`catalog_order` по их собственным `updated_at`.

**Осознанный компромисс:** младшая версия при конфликте молча теряется целиком, без merge и без предупреждения пользователю. Для личного трекера тренировок (один пользователь, конфликт — редкий и короткий по времени edge case) это приемлемо; пересмотреть, если появится сценарий с реально частыми одновременными правками с разных устройств.

### Эндпоинты

**`GET /sync/pull?since=<ISO timestamp>`** — всё, что изменилось на сервере после `since` (первый синк — `since` не передаётся, отдаётся всё).

```json
{
  "workouts": [ /* Workout[], с вложенными exercises/sets */ ],
  "customMuscleGroups": [ /* ... */ ],
  "customExercises": [ /* ... */ ],
  "catalogOrder": { "groupOrder": [...], "exerciseOrder": {...} },
  "serverTime": "2026-08-29T10:00:00Z"
}
```

**`POST /sync/push`** — локальные изменения с момента последнего синка.

```json
{
  "lastSyncedAt": "2026-08-28T20:00:00Z",
  "workouts": [ /* изменённые/новые Workout[] */ ],
  "customMuscleGroups": [ /* ... */ ],
  "customExercises": [ /* ... */ ],
  "catalogOrder": { "groupOrder": [...], "exerciseOrder": {...} }
}
```

Ответ:

```json
{
  "accepted": ["workoutId1", "workoutId2"],
  "rejected": [
    { "id": "workoutId3", "reason": "stale", "current": { /* серверная версия этого Workout */ } }
  ],
  "serverTime": "2026-08-29T10:00:00Z"
}
```

Типичный поток на клиенте: `push` локальных изменений → применить `rejected` (перезаписать локальную версию серверной) → `pull` с новым `since` = предыдущий `serverTime` → сохранить `serverTime` как новый `lastSyncedAt`.

### Первая синхронизация после регистрации — не отдельный эндпоинт

Гостевой режим (лимит бесплатных тренировок без регистрации, счётчик и т.д.) — целиком на фронте, эта дока его не описывает и не должна: см. `LiftTracker/docs/02-mvp.md` (v1.3) и `LiftTracker/docs/04-decisions.md`.

Момент "юзер только что зарегистрировался, у него N тренировок в `localStorage`, их нужно перенести на сервер" — это **не** отдельный эндпоинт вроде `/workouts/import`, а обычный `POST /sync/push`, вызванный в первый раз. На свежем аккаунте на сервере ещё нет ни одной тренировки, поэтому конфликтовать не с чем — весь LWW-сценарий (сравнение `updated_at`, непустой `rejected`) в этом частном случае не может сработать. Это удобно: `push` можно реализовать и протестировать как первый вертикальный срез, вообще не трогая `pull` и не думая про конфликты — они появляются только начиная со второго `push` (второе устройство, повторная синхронизация после первой).

**Реализовано иначе, чем планировалось изначально (2026-09-05):** фронт **не чистит** `localStorage` после первой синхронизации ни при каких условиях, включая `rejected: []`. `localStorage` навсегда остаётся локальным офлайн-кэшем поверх бэка как source of truth — соответствует разделу 1 этого документа ("не как замена локального хранилища") и `LiftTracker/CLAUDE.md`. `rejected: []` при этом всё ещё значим, просто для другого — это признак "первый push прошёл без конфликтов", по которому фронт применяет пришедшие `rejected[].current` (если есть) и продолжает пуш+пул через `syncApi.ts#runFullSync()`; сами локальные данные не трогает.

Рекомендуемый порядок реализации: `push` (руками проверить сценарий "N локальных тренировок → push → в БД лежит N тренировок, `rejected` пуст") → и только потом `pull`.

---

## 6. Что НЕ синхронизируется

Из `LiftTracker/docs/04-decisions.md` — остаётся только в `localStorage`/cookie на устройстве, у бэкенда для этого нет ни таблиц, ни эндпоинтов:

- `primaryColor` (`settings.ts`) — косметика.
- `restTimerMode` / `restTimerDuration` / `restTimerSoundEnabled` / `restTimerSoundId` (`settings.ts`) — настройки таймера отдыха, звук выбирается из захардкоженного на фронте каталога.
- `lift-tracker-locale` — язык интерфейса (cookie, не `localStorage`). Переводы принципиально живут на фронте навсегда, см. `LiftTracker/docs/00-vision.md`.

---

## 7. Открытые вопросы

- **Один email, два способа входа — решено (2026-09-02).** Сливать в один `users`-ряд по email: если email уже зарегистрирован через пароль, а юзер логинится через Google с тем же адресом (или наоборот) — это один и тот же пользователь, не два разных аккаунта. Реализация (`/auth/google/callback`) сама пока отложена — Google OAuth не в текущем заходе, email+password приоритет; но когда до неё дойдёт очередь, `findByEmail` перед созданием нового юзера должен находить существующую запись независимо от способа входа.
- **Синхронизация soft-deleted записей — решено и реализовано.** `custom_exercises`/`custom_muscle_groups` с `is_deleted=true` синхронизируются — `pull` их не фильтрует, см. `src/sync/sync.service.ts` и `LEARNING.md` раздел 12.
- **Миграции.** Решено использовать TypeORM (см. [DECISIONS.md](DECISIONS.md)) — миграции генерируются/гоняются через его CLI, а не отдельным раннером поверх сырых `.sql`.
- **Гранулярность конфликтов.** LWW на уровне целого `Workout` — сознательный выбор для v1.3 (см. раздел 5). Если окажется недостаточно (например, реальные жалобы на потерю данных при синке с двух устройств) — пересмотреть на гранулярность `WorkoutExercise`/`SetEntry`.
