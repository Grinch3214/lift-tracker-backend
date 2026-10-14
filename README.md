# lift-tracker-backend

Backend for LiftTracker: auth and workout sync across devices. NestJS + TypeORM + PostgreSQL.

## Run locally

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run migration:run
npm run start:dev
```

Check: `curl http://localhost:6600/health`

## Docs

- [API.md](API.md) — endpoints
- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture and design rationale
- [DECISIONS.md](DECISIONS.md) — decision log
- [CHANGELOG.md](CHANGELOG.md) — change history
