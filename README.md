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

## CLI

The `open-locale` CLI uploads and downloads translation files from the terminal.
It is zero-dependency (Node 20+) and talks to the REST API with a personal API
token (create one in project settings). The CLI is not published to npm; from a
repo checkout, `npm install` links the workspace bin locally, so
`npx open-locale <command>` works from the repo root.

Config comes from `./open-locale.json` or environment variables
(`OPENLOCALE_URL`, `OPENLOCALE_TOKEN`, `OPENLOCALE_PROJECT` override the file):

```json
{ "url": "http://localhost:3000", "token": "<api token>", "project": "<project id>" }
```

```bash
open-locale push <file> --locale he             # import one locale (format from the file extension)
open-locale push <file> --locale he --dry-run   # preview counts, writes nothing
open-locale push <file.zip>                     # import a bundle (one entry per locale)
open-locale pull --locale he [--format f] [-o file]   # export one locale
open-locale pull --all [--format f] -o bundle.zip     # export every locale as one zip
open-locale keys [--search term]                # list keys
open-locale imports [--limit N]                 # audit recent import runs (newest first)
open-locale docs                                # print the OpenAPI docs URL
```

Formats: json, csv, android, ios, po, pot, xliff, properties, arb, yaml, resx. Each format
is a subset: constructs outside the subset are rejected with an error rather
than approximated. `push`, `pull` and `keys` accept `--branch <name>` to scope
the read or write to a branch instead of main; import runs are not
branch-scoped.

Bundle zips are store-only, as written by `pull --all`; compressed zips are
rejected before any write. A bundle import runs per locale independently:
entries with no matching locale are skipped, failed locales are reported, and
nothing is rolled back across locales. Exit codes: 0 on success (skipped bundle
entries keep exit 0 and are listed on stderr), 1 on any failed key or locale.
`--dry-run` prints the same counters as a point-in-time preview without
writing; it is not available for bundle zips.

## Tests

Every database-backed suite starts its own real PostgreSQL automatically; no Docker
required. Each suite exits non-zero if any check fails.

```bash
bash scripts/sweep.sh                       # everything: 31 suites that each start a
                                            # real PostgreSQL, the OpenAPI docs check,
                                            # unit tests and production builds (36 legs)
npx nx test api && npx nx test web          # unit tests only
node scripts/e2e-visual.mjs                 # full UI pass in headless Chrome
npm run test:cli                            # one suite - see package.json for the full list
```

The sweep fails if any leg exits non-zero, prints a FAIL line or runs zero checks.

## Development process

Every development goes through five clean review passes before commit:
developer, product manager, designer, security researcher, QA/integration.
Findings are fixed and the passes re-run; only then is a commit made.
See docs/PLAN.md.

## License

Not yet chosen. MIT is the current recommendation; a LICENSE file lands with that decision.
