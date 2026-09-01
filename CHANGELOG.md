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
