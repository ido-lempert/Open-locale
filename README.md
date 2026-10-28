# Open-locale

Open-source localization management platform: a self-hosted alternative to Lokalise.
Nx monorepo with an Angular web app, a NestJS API and PostgreSQL.

> Status: early development. See [docs/PLAN.md](docs/PLAN.md) for the capability map
> and the prioritized phase plan. Not yet licensed - see "License" below.

## Stack

- **Web** - Angular (standalone, zoneless), `apps/web`
- **API** - NestJS + Prisma, `apps/api`
- **DB** - PostgreSQL 16
- **Monorepo** - Nx 24, npm workspaces

## Run with Docker

Prerequisites: Docker and Docker Compose.

```bash
cp .env.example .env   # adjust secrets
docker compose up --build
```

- Web: http://localhost:4200
- API: http://localhost:3000/api

The Docker configuration is prepared but not yet executed end to end; database-backed
checks in CI run against a real PostgreSQL started by the test harness.

## Develop locally (no Docker)

Prerequisites: Node.js 22 (see .nvmrc / package.json engines). PostgreSQL is started
for you; no separate database install is needed.

```bash
npm install
npm run dev:api    # boots a temporary PostgreSQL + migrations, serves API on :3000
npx nx serve web   # starts web on :4200, proxies /api to :3000
```

`npm run dev:api` uses [embedded-postgres](https://www.npmjs.com/package/embedded-postgres);
the database is temporary and deleted when the process stops. To run against your own
PostgreSQL instead, set DATABASE_URL (and JWT_SECRET) and use `npx nx serve api`.

The API binds to 127.0.0.1 by default outside production; the embedded PostgreSQL is
loopback-only too. To expose the API beyond localhost, set HOST explicitly together
with a real JWT_SECRET - the process refuses to bind a non-loopback address while
running on the built-in development secret.

## Tests

Every database-backed suite starts its own real PostgreSQL automatically; no Docker
required. Each suite exits non-zero if any check fails.

```bash
npx nx test api && npx nx test web          # unit tests
npm run test:integration                    # phase 0 foundation
npm run test:authz                          # auth, tokens, authorization
npm run test:statuses                       # review statuses + history
npm run test:tags                           # tags + filters
npm run test:comments                       # comments
npm run test:activity                       # activity log
npm run test:imports                        # JSON import + ImportRun recovery
npm run test:screenshots                    # screenshot upload validation
npm run test:tasks                          # tasks
npm run test:tm                             # translation memory
npm run test:glossary                       # glossary
npm run test:qa                             # QA checks
npm run test:formats                        # CSV import/export
node scripts/e2e-visual.mjs                 # full UI pass in headless Chrome
```

## Development process

Every development goes through five clean review passes before commit:
developer, product manager, designer, security researcher, QA/integration.
Findings are fixed and the passes re-run; only then is a commit made.
See docs/PLAN.md.

## License

Not yet chosen. MIT is the current recommendation; a LICENSE file lands with that decision.
