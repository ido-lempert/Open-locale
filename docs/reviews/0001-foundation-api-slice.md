# Review 0001 - foundation scaffold + API vertical slice

Date: 2026-10-28. Scope: Nx monorepo scaffold (apps/web Angular 22, apps/api NestJS 11),
Prisma Phase 0 schema + initial migration, auth (JWT + API tokens), projects/locales/keys/
translations CRUD, JSON import/export, Docker assets, docs (README, PLAN), integration
test on real PostgreSQL. No product UI in this slice (editor v1 follows as its own commit).

## Pass 1 - Developer
Findings:
1. Signup with an existing email surfaced as an unhandled Prisma error (HTTP 500). Fixed: explicit check, now 409 ConflictException.
2. importJson runs sequential upserts per key (N+1). Accepted for Phase 0 volumes; batching ticketed for Phase 1.
3. Embedded-Postgres integration test could not run inside Jest (embedded-postgres is ESM-only, Jest here is CJS). Reworked as a plain Node script (scripts/phase0-db-test.mjs) run in CI/dev directly. Unit tests stay in Jest.
Clean rerun: `nx build api` OK, `nx test api` 5/5 pass.

## Pass 2 - Product manager
Findings:
1. Plan says "Projects, languages, keys: full CRUD" - project update/delete were missing. Fixed: PATCH /api/projects/:id and DELETE /api/projects/:id added (delete cascades, covered by integration test).
2. Commit scope is the API slice only; plan items "translation editor v1" (UI) is explicitly NOT in this commit and is tracked next. No parity claim made.
Matches PLAN.md Phase 0 items 1-4 and 6 (import/export) at API level.

## Pass 3 - Designer
No user-facing surface ships in this commit; apps/web remains the Nx starter and is not
presented as product UI. Designer passes become load-bearing with the editor v1 commit.
Finding: none for this slice (recorded honestly rather than a rubber stamp).

## Pass 4 - Security researcher
Findings:
1. `npm audit` production: 5 high (multer DoS via @nestjs/platform-express; deepmerge-ts stack exhaustion via prisma 6 CLI config). Fixed with npm overrides: multer ^2.5.0, deepmerge-ts ^8.0.2. Post-fix `npm audit --omit=dev`: 0 vulnerabilities. Full-tree remaining: dev-tooling only (Nx/webpack chain), recorded, no runtime exposure.
2. JWT secret had a silent dev fallback. Contained: API now refuses to boot in production without JWT_SECRET; .env.example documents it.
3. CORS reflected any origin unconditionally. Fixed: CORS_ORIGIN env, default reflect for dev only.
4. Verified: bcrypt cost 12; API tokens stored as SHA-256 hash, compared with timingSafeEqual, raw token shown once at creation; all project/key/translation routes behind JwtAuthGuard (JWT or X-Api-Key) and team-scoped queries; ValidationPipe whitelist strips unknown fields; .env gitignored; no secrets in the diff.
Deferred (recorded, not blocking): API token scopes are stored but not yet enforced (Phase 2 API v1), no rate limiting yet (Phase 2), audit log arrives Phase 1.

## Pass 5 - QA / integration
Evidence (all on real PostgreSQL via embedded-postgres, not mocks):
- `prisma migrate deploy` applies 000000000000_init cleanly.
- signup creates user + owned team; project with en+he locales; key/translation upserts; JSON export round-trip; Hebrew (unicode) value round-trip; duplicate key name rejected; project delete cascades. 7/7 checks pass.
- `nx build api` and `nx build web` succeed; `nx test api` 5/5, `nx test web` 1/1.
- Docker assets are config-checked only: docker compose was NOT executed (no Docker in the build environment). Dockerfile/compose correctness is verified by inspection, not by a build run.

## Outcome
All findings fixed or explicitly deferred with a phase. Passes re-run clean. Cleared to commit.
