# Review 0021 - API token management hardening

## Finding (security pass)

`POST/GET/DELETE /api/auth/tokens` were protected only by `JwtAuthGuard`, which accepts both
session JWTs and `X-Api-Key` tokens. A leaked read+write API token could therefore mint new
tokens (successors surviving revocation of the leaked one), enumerate existing token metadata,
and revoke other tokens. Token management is now session-only (`via !== 'jwt'` -> 403).

## Changes

- `auth.controller`: `requireSession` on all three token endpoints; `expiresAt` accepted on
  create with validation (must be a future ISO timestamp, else 400).
- `auth.service`: `createApiToken` persists optional `expiresAt`.
- `scripts/api-tokens-test.mjs` (new, `npm run test:apitokens`): 21 checks against real
  PostgreSQL + the real built API.

## Verified (exit 0 at this commit)

- test:apitokens 21 PASS: signup issues JWT; create returns raw token once; read-only create;
  unknown scope 400; write-without-read 400; list hides raw/hash; DB stores only SHA-256 hashes;
  X-Api-Key read and write; read-only write 403; API token cannot create/list/revoke tokens
  (all 403); future expiry accepted; past expiry 400; expired token 401; revoke works and the
  revoked token is 401; unknown token 401.
- test:authz 28 PASS (regression), test:integration 7 PASS, api unit 31/31.

## Note for future tests

The `api_tokens` table uses `timestamp without time zone`; Prisma writes JS Dates as UTC wall
time. Test SQL that backdates rows must use naive UTC literals, not `now()` (which converts to
the session time zone on assignment).
