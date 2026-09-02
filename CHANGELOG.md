# Changelog

## 2026-08-30

### Added

- Bare NestJS scaffold (`nest new`).
- `.gitignore`, `.gitattributes` (LF everywhere).

### Fixed

- CRLF line endings causing `prettier/prettier` lint errors — normalized to LF.
- Unused, soon-deprecated `baseUrl` removed from `tsconfig.json`.

## 2026-09-01

### Added

- `docker-compose.yml` + `.env`/`.env.example` — Postgres 16 (recovered from an earlier abandoned backend attempt in the frontend repo's history).
- Hand-written SQL migrations (`migrations/0001-0004`): `users`, `workouts`, `workout_exercises`, `set_entries`.
- TypeORM: entities for all 4 tables, `src/data-source.ts`, `migration:generate`/`run`/`revert` scripts. Entities verified against the existing schema (`migration:generate` → empty diff).
- `GET /db-time` — proves live DB connectivity.
- `DECISIONS.md` — decision log, mirrors frontend's `docs/04-decisions.md`.

### Changed

- Stack: raw SQL (`pg`) → TypeORM (see `DECISIONS.md`).
- `ARCHITECTURE.md` updated to match (stack section, open questions).

## 2026-09-02

### Added

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (rotates the refresh token), `POST /auth/logout` (revokes it, idempotent) — email+password only, Google OAuth deferred. bcrypt password hashing, JWT access token (15m) + sha256-hashed refresh token stored in a new `refresh_tokens` table. `class-validator` DTOs + global `ValidationPipe`.
- `UsersModule`/`UsersService` (findByEmail/create).
- `LEARNING.md` — personal, gitignored notes explaining Nest/TypeORM internals for learning purposes.

### Fixed

- `data-source.ts`'s `migrations` glob pointed at `src/migrations/*.ts` unconditionally — worked under `ts-node` (CLI) but crashed the compiled app (`dist/`) with a cryptic `SyntaxError: Unexpected strict mode reserved word` (Node trying to parse raw TypeScript as JS). Now resolves relative to `__dirname` with both extensions.

- `JwtAuthGuard` + `@CurrentUser()` decorator — protects routes, resolves the calling user from the access token instead of trusting the request body. `GET /auth/me` as a live test route for it.
- Sync: `GET /sync/pull` (optional `?since=`) and `POST /sync/push` (per-workout LWW via `updated_at`, transactional delete+reinsert of `workout_exercises`/`set_entries` per accepted workout). Both guarded. `custom_muscle_groups`/`custom_exercises`/`catalog_order` sync deferred — those tables don't exist yet.

### Changed

- Rebuilt the dev database from scratch through 5 separate TypeORM migrations (`CreateUsers`/`CreateRefreshTokens`/`CreateWorkouts`/`CreateWorkoutExercises`/`CreateSetEntries`, one table per step), and deleted the old hand-written `migrations/0001-0004.sql` — TypeORM's own migration history previously only knew about `refresh_tokens`, so `migration:run` on an empty DB would not have recreated the other 4 tables at all.
- Added inverse `@OneToMany` relations (`Workout.workoutExercises`, `WorkoutExercise.setEntries`) — needed for `pull`'s nested `relations` query; no schema change (confirmed via `migration:generate` → empty diff).
