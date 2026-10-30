# Review 0080 - Docker packaging static hardening (slice 16)

## Why
The user explicitly authorized Docker ("install what's missing with docker"),
but the development sandbox has no Docker daemon (checked: no docker, podman or
nerdctl binaries), so the compose stack cannot be executed here. What CAN be
verified in-sandbox is that the packaging is correct and complete. Static
review found the stack would NOT have booted as shipped.

## Defects found by static review (real packaging defects, caught pre-execution)
1. docker-compose did not pass TOTP_ENCRYPTION_KEY to the api service. The API
   fails closed at startup in production (NODE_ENV=production is set in the
   Dockerfile) without a strong TOTP key - the container would have
   crash-looped.
2. The api service had no healthcheck and web did not wait for it, so nginx
   could proxy to a not-yet-migrated API on first boot.
3. .dockerignore was missing (the daemon would receive node_modules/dist/.git
   as build context).
4. The api runtime stage lacked openssl, which Prisma engines require on
   alpine.

## Fixes
- compose: api now receives TOTP_ENCRYPTION_KEY and CORS_ORIGIN; api has a
  healthcheck hitting the real GET /api/health route; web depends on
  service_healthy for api.
- New GET /api/health: public liveness that proves HTTP serving AND a real
  database round-trip (SELECT 1) - a wedged pool reads as down, not up.
  Registered in openapi.ts (docs leg enforces this).
- .env.example documents TOTP_ENCRYPTION_KEY (required, >=16 chars).
- .dockerignore excludes node_modules, dist, .git, .nx, logs, coverage.
- apps/api/Dockerfile runtime stage installs openssl.

## Verification (this HEAD)
- NEW scripts/docker-static-test.mjs: 23 PASS / 0 FAIL / RC=0. Proves: compose
  wiring (secrets, healthchecks, depends_on conditions, Dockerfile references),
  every ${VAR} substituted by compose documented in .env.example, every
  Dockerfile COPY source path exists, prisma generate + migrate deploy + nx
  output paths coherent, nginx proxy + SPA fallback, .dockerignore entries.
  Wired as sweep leg test:docker.
- authz suite: 29 PASS / 0 FAIL / RC=0 (was 28; +1: health endpoint reports
  HTTP + database up over real HTTP against real PostgreSQL).
- api build: RC=0 (health endpoint compiled into dist).

## Boundary (per parent direction)
This does NOT promote the docker-compose coverage item: "runs with one command"
requires an actual docker compose up, which needs a machine with a Docker
daemon. The item stays PARTIAL; local static verification is distinct from
execution acceptance.
