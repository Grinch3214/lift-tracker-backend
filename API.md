# API Reference

**Важно:** этот файл поддерживается вручную. Если меняешь DTO/контроллер — обнови и этот файл в том же коммите, иначе он быстро разойдётся с кодом.

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

**Ошибки:** `400` — невалидный email/короткий пароль. `409` — email уже занят.

---

### `POST /auth/login`

**Тело запроса:** то же, что `/auth/register` (`email`, `password`).

**Ответ `200`:** та же форма, что у `/auth/register`.

**Ошибки:** `400` — невалидный ввод. `401` — неверный email или пароль.

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

## Служебное (не для интеграции с фронтом)

- `GET /` — заглушка `Hello World` из `nest new`. Будет удалена при чистке `AppController`.
- `GET /db-time` — проверка живого коннекта к Postgres, использовалась при первой настройке TypeORM. Тоже кандидат на удаление.

---
