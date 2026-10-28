# Review 0022 - API docs consistency + CLI

## Docs consistency (scripts/docs-consistency-test.mjs)

The hand-maintained OpenAPI spec is now machine-checked against the controllers, both
directions: every implemented route documented, no documented route unimplemented, exact
operation count, and every non-public operation declaring security. Initial run caught one
real gap (GET /api/openapi.json missing from the spec); fixed. 50 documented = 50 implemented.

## Token verification depth (api-tokens-test.mjs, 34 checks)

Added per review: expired session JWT on token management -> 401; malformed JWT -> 401;
expiry proven through the API write path (create with expiresAt ~1.5s out, usable before,
401 after) plus an equivalent-instant +02:00 offset spelling rejected as past; read-only
token blocked from webhook and task writes (403) while reads pass. Scope precision: tokens
are user-wide read/write; per-project or per-route narrowing is NOT implemented and is not
claimed.

## CLI (apps/cli, npm run test:cli - 7 checks)

Zero-dependency Node CLI: push (JSON/CSV/Android/iOS import), pull (export with
--format json|csv|android|ios, -o file or stdout), keys, docs. Config via open-locale.json
or env (OPENLOCALE_URL/TOKEN/PROJECT); 401/403 produce actionable errors. E2E suite proves
push -> API export, keys, pull file/stdout, Android XML stdout, read-only token push blocked,
and missing-config guidance.

## Verified at this commit (exit 0)

apitokens 34, docs-consistency 4, cli 7, api unit 31/31, nx build api + web.
