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

### Added (cont.)

- `JwtAuthGuard` + `@CurrentUser()` decorator — protects routes, resolves the calling user from the access token instead of trusting the request body. `GET /auth/me` as a live test route for it.
- Sync: `GET /sync/pull` (optional `?since=`) and `POST /sync/push` (per-workout LWW via `updated_at`, transactional delete+reinsert of `workout_exercises`/`set_entries` per accepted workout). Both guarded.
- Sync extended to the catalog domain: `custom_muscle_groups`, `custom_exercises`, `catalog_order` (JSONB, one row per user) — new tables/entities, folded into the same `push`/`pull` with the same LWW-by-`updated_at` pattern. `pull` intentionally does NOT filter out soft-deleted (`is_deleted: true`) rows — client decides whether to hide them; old workouts may still reference a deleted custom exercise by id and need the name to keep resolving.

### Changed

- Rebuilt the dev database from scratch through 5 separate TypeORM migrations (`CreateUsers`/`CreateRefreshTokens`/`CreateWorkouts`/`CreateWorkoutExercises`/`CreateSetEntries`, one table per step), and deleted the old hand-written `migrations/0001-0004.sql` — TypeORM's own migration history previously only knew about `refresh_tokens`, so `migration:run` on an empty DB would not have recreated the other 4 tables at all.
- Added inverse `@OneToMany` relations (`Workout.workoutExercises`, `WorkoutExercise.setEntries`) — needed for `pull`'s nested `relations` query; no schema change (confirmed via `migration:generate` → empty diff).
- 3 more one-table-per-step migrations for the catalog domain (`CreateCustomMuscleGroups`/`CreateCustomExercises`/`CreateCatalogOrder`), same narrow-then-widen `entities` technique as before.

### Added (security)

- Rate limiting (`@nestjs/throttler`): global default 100 req/min per IP, tightened to 5 req/min on `POST /auth/register`/`POST /auth/login` specifically (the brute-forceable/spammable ones). Verified live — 6th rapid login attempt returns `429`.
- `helmet()` — standard security response headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, hides `X-Powered-By`, etc.). Verified live via response headers.
- CORS enabled (`app.enableCors`), origin list configurable via `CORS_ORIGIN` env var (comma-separated); permissive (`origin: true`, reflects any request origin) when unset — no fixed frontend origin decided yet.
- `API.md` — plain endpoint reference (method/path/auth/request/response/errors) for frontend integration, separate from `ARCHITECTURE.md`'s design rationale. Manually maintained — must be updated alongside any controller/DTO change.

### Changed (docs)

- `ARCHITECTURE.md` open question "Один email, два способа входа" resolved: merge by email into one `users` row regardless of auth method, whenever Google OAuth is actually implemented (still deferred). "Синхронизация soft-deleted записей" open question marked resolved — implemented, not just decided.

## 2026-09-03

### Removed

- `GET /` (`Hello World` placeholder from `nest new`) and `GET /db-time` (ad-hoc DB-connectivity check used while first setting up TypeORM) — both replaced by a single proper `GET /health`.

### Added

- `GET /health` — `{ status: 'ok', database: 'up' }` on `200`, `{ status: 'error', database: 'down' }` on `503` if Postgres is unreachable (`ServiceUnavailableException`). No auth required.

### Changed

- `app.controller.spec.ts`/`test/app.e2e-spec.ts` updated to test `/health` (both success and DB-down paths) instead of the removed `Hello World` route.

## 2026-09-05

### Changed (docs)

- `ARCHITECTURE.md` §5 corrected a stale plan vs. what the frontend actually shipped: the doc said the client should clear `localStorage` on seeing `rejected: []` from the first `push`. It doesn't and won't — `localStorage` stays a permanent offline cache in front of the backend (matches §1's "не как замена локального хранилища"), never cleared post-sync. `rejected: []` still matters, just for a narrower thing: "first push had no conflicts." Frontend-side sync (push/pull, auth wiring, background triggers) is implemented — see `LiftTracker/docs/02-mvp.md` v1.3 and `LiftTracker/CLAUDE.md` for what actually got built.
- `ARCHITECTURE.md` §4's endpoint table marked `GET /auth/google`/`GET /auth/google/callback` as not implemented (⏸) — they were listed among this version's endpoints with no inline indicator that they're deferred (the deferral was only noted in §7). `API.md`, the frontend-integration reference, already correctly omits them.

## 2026-09-07

### Changed

- `JWT_REFRESH_EXPIRES_DAYS` 30 → 60. `JWT_ACCESS_EXPIRES_IN` stays 15m (deliberately — it's the one lever that bounds damage from a stolen/leaked access token, since it can't be revoked; a longer session is `refreshToken`'s job, not this one's).

## 2026-09-23

### Added

- `Dockerfile` — multi-stage build for the app itself (previously only Postgres was containerized via `docker-compose.yml`). `deps`/`build` stages install full deps and run `nest build`; `prod-deps`/`runtime` stages install only `dependencies` (no `typescript`/`@nestjs/cli`/etc.) and run `node dist/main.js` as a non-root user. Built for a home-server deploy (Cloudflare Tunnel, no direct port-forwarding) — not yet build-tested live (Docker daemon was off on this machine; user will validate on the target laptop).
- `.dockerignore` — excludes `node_modules`, `.git`, `dist`, and critically `.env`/`.env.*` (only `.env.example` is allowed through) from the build context.
- `migration:run:prod` npm script (`typeorm migration:run -d dist/data-source.js`) — the existing `migration:run` uses `typeorm-ts-node-commonjs`, which needs `ts-node` (a devDependency, absent from the production image). This one runs against the already-compiled `dist/data-source.js` via the plain `typeorm` CLI binary, which ships in the `typeorm` package itself (a regular dependency) — works inside the runtime container with no dev deps installed.
