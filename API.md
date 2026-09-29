# API Reference

**Важно:** этот файл поддерживается вручную. Если меняешь DTO/контроллер — обнови и этот файл в том же коммите, иначе он быстро разойдётся с кодом.

**Общее для всех эндпоинтов:**
- Rate limit по умолчанию — 100 запросов в минуту с одного IP (`429` при превышении). На `/auth/register`/`/auth/login` — жёстче, 5/мин.
- Ответы содержат стандартные security-заголовки (`helmet`) — не влияет на контракт, просто есть.
- CORS открыт для любого origin, пока не задан `CORS_ORIGIN` в `.env`.

---

## Аутентификация (`/auth`)

### `POST /auth/register`

Регистрация нового пользователя (email + пароль).

**Тело запроса:**

```json
{
  "email": "user@example.com",
  "password": "supersecret123"
}
```

- `email` — валидный email (`class-validator` `@IsEmail`).
- `password` — строка, минимум 8 символов.

**Ответ `201`:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "f98ff45aa750857d...",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

**Ошибки:** `400` — невалидный email/короткий пароль. `409` — email уже занят. `429` — больше 5 запросов в минуту с одного IP (rate limit).

---

### `POST /auth/login`

**Тело запроса:** то же, что `/auth/register` (`email`, `password`).

**Ответ `200`:** та же форма, что у `/auth/register`.

**Ошибки:** `400` — невалидный ввод. `401` — неверный email или пароль. `429` — больше 5 запросов в минуту с одного IP (rate limit).

---

### `POST /auth/refresh`

Обновляет пару токенов. Старый `refreshToken` перестаёт работать сразу после использования (ротация).

**Тело запроса:**

```json
{ "refreshToken": "f98ff45aa750857d..." }
```

**Ответ `200`:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "18da0a090d81c8b4..."
}
```

Без `user` — только токены.

**Ошибки:** `401` — токен не найден, уже использован (ротирован) или просрочен (30 дней).

---

### `POST /auth/logout`

Отзывает конкретный `refreshToken`. Идемпотентен — повторный вызов или вызов с уже недействительным токеном тоже вернёт `204`, не ошибку.

**Тело запроса:**

```json
{ "refreshToken": "18da0a090d81c8b4..." }
```

**Ответ:** `204`, пустое тело.

**Важно:** отзывает только `refreshToken`. Уже выданный `accessToken`, если ещё не истёк (до 15 минут), продолжит работать — logout не может отозвать его, он самопроверяемый (stateless JWT).

---

### `GET /auth/me` 🔒

Проверка токена / "кто я". Требует заголовок:

```
Authorization: Bearer <accessToken>
```

**Ответ `200`:**

```json
{ "id": "uuid" }
```

**Ошибки:** `401` — заголовка нет, токен невалиден или истёк.

---

## Синхронизация (`/sync`) 🔒

Оба эндпоинта требуют `Authorization: Bearer <accessToken>`. `userId` всегда берётся из токена, никогда из тела запроса.

### `GET /sync/pull`

**Query-параметры:**

- `since` (необязательный) — ISO 8601 timestamp. Без него — отдаётся вся история пользователя (первый синк). С ним — только записи, у которых `updatedAt` новее.

```
GET /sync/pull?since=2026-09-01T00:00:00.000Z
```

**Ответ `200`:**

```json
{
  "workouts": [/* WireWorkout[], см. ниже */],
  "customMuscleGroups": [/* WireCustomMuscleGroup[] */],
  "customExercises": [/* WireCustomExercise[] */],
  "catalogOrder": { "groupOrder": [], "exerciseOrder": {}, "updatedAt": "..." },
  "serverTime": "2026-09-02T14:27:23.638Z"
}
```

`catalogOrder` — `null`, если пользователь ещё ни разу его не пушил.

**`customMuscleGroups`/`customExercises` включают soft-deleted записи** (`isDeleted: true`) — сервер их не фильтрует, фронт сам решает, скрывать ли в UI. Нужно для резолва названий в старых тренировках.

---

### `POST /sync/push`

**Тело запроса** — любое подмножество полей, все необязательны кроме структуры внутри:

```json
{
  "lastSyncedAt": "2026-09-01T20:00:00.000Z",
  "workouts": [/* PushWorkoutDto[] */],
  "customMuscleGroups": [/* PushCustomMuscleGroupDto[] */],
  "customExercises": [/* PushCustomExerciseDto[] */],
  "catalogOrder": {/* PushCatalogOrderDto */}
}
```

`lastSyncedAt` присутствует в контракте, но сервером не используется — решение по каждой записи принимается по её собственному `updatedAt`, не по этому полю.

**Ответ `200`:**

```json
{
  "accepted": ["id1", "id2"],
  "rejected": [
    {
      "id": "id3",
      "reason": "stale",
      "current": {/* актуальная серверная версия */}
    }
  ],
  "serverTime": "2026-09-02T14:27:23.620Z"
}
```

`accepted`/`rejected` — общий пул id из **всех** отправленных доменов разом (workouts + customMuscleGroups + customExercises + catalogOrder, если был). Для `catalogOrder` в качестве `id` используется `userId` (это и есть его первичный ключ — одна запись на юзера).

**Логика принятия/отказа (LWW):** если на сервере уже есть версия этой записи с `updatedAt` **новее или равным** присланному — отказ (`rejected`, тело в `current` — актуальная версия с сервера, клиент должен принять её как истину). Иначе — запись создаётся или полностью заменяется.

**Ошибки:** `400` — не прошла валидация (не-UUID id, дата не в ISO-формате и т.д.). `401` — нет/невалиден токен.

---

## Формы данных (Wire-контракты)

### `PushWorkoutDto` / `WireWorkout`

```ts
{
  id: string;          // UUID
  date: string;        // 'YYYY-MM-DD'
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601, обязательное — им сравнивается LWW
  exercises: [
    {
      id: string;         // UUID
      exerciseId: string; // ссылка в каталог (не FK)
      order?: number;
      supersetId?: string; // UUID, общая метка для 2+ упражнений в одном суперсете
      sets: [
        {
          id: string;              // UUID
          weight?: number;
          reps?: number;
          durationSeconds?: number;
          distanceKm?: number;
          dumbbellCount?: 1 | 2;
          isCompleted: boolean;
        }
      ];
    }
  ];
}
```

### `PushCustomMuscleGroupDto` / `WireCustomMuscleGroup`

```ts
{
  id: string; // UUID
  name: string;
  order: number;
  isDeleted: boolean;
  updatedAt: string; // ISO 8601
}
```

### `PushCustomExerciseDto` / `WireCustomExercise`

```ts
{
  id: string;             // UUID
  muscleGroupId: string;  // ссылка в каталог (не FK)
  name: string;
  equipment?: string;
  trackingType: 'weight-reps' | 'time-distance';
  order?: number;
  mediaId?: string;       // UUID, см. `/media` ниже — id фото, само фото сюда не входит
  isDeleted: boolean;
  updatedAt: string;      // ISO 8601
}
```

### `PushCatalogOrderDto` / `WireCatalogOrder`

```ts
{
  groupOrder: string[];                       // порядок id групп мышц
  exerciseOrder: Record<string, string[]>;    // muscleGroupId -> порядок id упражнений
  updatedAt: string;                          // ISO 8601
}
```

---

## Фото упражнений (`/media`)

Фото для кастомных упражнений: `mediaId` — UUID v4, генерируется клиентом (как и остальные id в проекте), а не сервером — офлайн-first, фото может ссылаться на id ещё до того, как появится сеть для загрузки.

### `PUT /media/:id` 🔒

Загружает (или перезаписывает свою же) картинку под заданным `id`. Требует `Authorization: Bearer <accessToken>`.

**Тело запроса:** `multipart/form-data`, файл в поле `file`.

- Принимаются только `image/webp` и `image/jpeg` — определяется по первым байтам файла, не по заголовку от клиента.
- Лимит размера — 300 КБ (после клиентского сжатия фото весит ~20–60 КБ).
- Один и тот же `id` от того же пользователя можно PUT'ить повторно (идемпотентно, безопасно ретраить) — перезаписывает файл. От **другого** пользователя на уже занятый `id` — отказ.

**Ответ `200`:**
```json
{ "id": "a29ebca3-e57b-4e93-8acc-648537927b88" }
```

**Ошибки:** `400` — файл не передан / больше 300 КБ / не webp и не jpeg. `401` — нет/невалиден токен. `403` — `id` уже занят другим пользователем.

---

### `GET /media/:id`

Отдаёт картинку. **Без авторизации** — публично по неугадываемому UUID (122 бита случайности, практически невозможно подобрать перебором). Расширение в пути необязательно и не проверяется (`GET /media/<id>` и `GET /media/<id>.webp` эквивалентны) — тип берётся из того, что было определено при загрузке.

**Ответ `200`:** тело — сами байты картинки, `Content-Type: image/webp` или `image/jpeg`, `Cache-Control: public, max-age=31536000, immutable` (один `id` — всегда одна и та же картинка, замена фото на клиенте = новый `id`).

**Ответ `404`** — нет такой записи (не загружена, или ушёл кто-то с некорректным id).

---

## Служебное

### `GET /health`

Проверка живого коннекта к Postgres (`SELECT 1`). Не требует токена.

**Ответ `200`:**
```json
{ "status": "ok", "database": "up" }
```

**Ответ `503`** (БД недоступна):
```json
{ "status": "error", "database": "down" }
```

---
