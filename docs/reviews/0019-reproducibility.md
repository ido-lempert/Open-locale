# Review 0019 - Reproducibility pass

## Scope
Make the documented run path real and verified: npm run dev:api (scripts/dev-db.mjs)
boots a temporary embedded PostgreSQL, applies migrations, serves the API - one
command, no Docker. Node 22 pinned (.nvmrc + engines). README corrected: it previously
claimed `nx serve api` used embedded Postgres by default, which was false. Test
commands enumerated; missing test:tags script registered (suite existed unregistered).

## Pass 1 - Developer
- Verified live: `PORT=3055 npm run dev:api` boots PG, applies all migrations,
  serves; /api/projects returns 401 (guard live) within ~15s; SIGTERM cleans up the
  temporary cluster. test:tags runs green via npm script.

## Pass 2 - Product
- README now distinguishes: one-command temporary-DB dev (default), own-PostgreSQL
  dev (set DATABASE_URL/JWT_SECRET), Docker path (prepared, not yet executed - caveat
  retained verbatim). Test list matches package.json exactly.

## Pass 3 - Designer
- README structure unchanged in style; commands grouped by purpose; no visual assets
  affected.

## Pass 4 - Security
- Dev bootstrap defaults JWT_SECRET to 'dev-only-secret' only locally; production
  still refuses to boot without JWT_SECRET (existing main.ts guard). Temporary PG
  listens on 127.0.0.1 only with a throwaway data dir deleted on exit. .env.example
  secrets are placeholders marked change-me; no real credentials anywhere in the
  repo (spot-checked .env.example, docker-compose.yml, Dockerfiles).

## Pass 5 - QA / integration
- Full regression on the feature work preceding this commit: all 13 suites exit 0
  (phase0 7, authz 28, statuses 14, tags 9, comments 18, activity 24, imports 15,
  screenshots 18, tasks 15, tm 12, glossary 15, qa 9, formats 12), api unit 10/10,
  web unit 13/13, e2e-visual 40/40 exit 0.
- Docker build/run remains UNVERIFIED (no Docker available in this environment);
  the README keeps that caveat and nothing here claims otherwise.

## Known gaps
- docker-compose path unverified end to end (needs a Docker host).
- npm ci from a clean clone not yet verified in this environment (install-time).
