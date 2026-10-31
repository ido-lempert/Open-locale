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

## SDK

`libs/sdk` (`@open-locale/sdk`) is a zero-dependency ESM client for the REST
API v1 covering the core translation workflow - projects, keys, translations,
import/export with branch scoping, and OTA bundle pulls (latest or pinned
version, ETag revalidation, sha256 integrity verified before any bundle is
handed to the caller; on a 304 the digest header is returned for the caller
to compare against its own cached copy - the SDK never sees cached bytes).
The digest proves the body matches the header the server sent; it is not an
authenticity signature and does not protect against an attacker who can
replace both - that is what TLS and the read-scope token are for. It is not full API parity; other endpoints
are reachable through its low-level `request` escape hatch. Private to the
repo (not published). See docs/reviews/0062-sdk.md.

```js
import { createClient } from './libs/sdk/src/index.mjs';
const ol = createClient({ url: 'http://localhost:3000', token: process.env.OPENLOCALE_TOKEN });
const en = await ol.translations.get(projectId, 'en');
```

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


### SAML server configuration (local SP groundwork)

Set `SAML_ENTRY_POINT`, `SAML_IDP_CERT`, and `SAML_IDP_ENTITY_ID` together.
The IdP entity ID is required: a pinned certificate does not replace issuer
validation. The API refuses SAML operations when the issuer is missing.
`SAML_SP_ENTITY_ID` defaults to `open-locale`; `SAML_ACS_URL` defaults to
`http://127.0.0.1:3000/api/auth/saml/acs`.

Request signing is optional, but `SAML_SP_PRIVATE_KEY` and
`SAML_SP_SIGNING_CERT` must be configured together. Before generating a
request or metadata the SP requires a parseable RSA key and matching public
certificate. Use secret environment configuration for the private key, not
source control. The read-only settings status is not a cryptographic
configuration health check. Local mock tests are not external-IdP acceptance.
Set `SAML_BROWSER_RETURN_URL` to the web app's fixed
`/auth/saml/callback` URL to enable the browser sign-in button. HTTPS is
required except on loopback. The IdP still posts to the configured ACS.
Browser flows redirect with a short-lived one-use ticket in the fragment,
not a session JWT. Redemption also requires the same-tab verifier. Existing
API-only ACS calls still return JSON. Browser flow state, tickets and replay
cache are process-local; restart loses pending sign-ins and multi-instance
routing is not supported by these stores.

### Repository target reads (not sync)

Target configuration does not connect a repository. A deployment operator can
provide a separately authorized read credential in `GITHUB_READ_TOKEN`, scoped
by exact `GITHUB_READ_OWNER` and `GITHUB_READ_REPO`. No fallback credential is
used. Keep the token in deployment secrets, never repository files or browser
forms. Use read-only Contents access to that one repository. Installing an app,
creating a token or expanding access is a separate operator decision.

Session admins can POST `expectedRevision` to a target's `/read` endpoint. The
server reads bounded flat-string JSON from the fixed GitHub API, verifies its
blob SHA, and rechecks admin access and target revision before returning bytes
with `Cache-Control: no-store`. This does not accept a baseline, import or push,
store file bytes, or run sync. Missing matching access returns503; upstream or
unsupported JSON returns502. The target configuration UI can display a read-only file snapshot, never an
accepted baseline or sync result. The internal loopback fixture
override is ignored in production.

### Explicit remote baseline acceptance

Session admins can read a target's `/baseline` or explicitly accept reviewed
remote bytes by POSTing `expectedRevision`, `expectedRemoteSha`,
`expectedContentDigest` and `expectedBaselineVersion` (0 for the first snapshot).
The server freshly reads the file, rejects changes since review, and stores one
current versioned snapshot with its actor. Replacing target coordinates deletes
the accepted baseline. Target/project/branch removal cascades its baseline.

Acceptance means only that an admin selected these verified remote bytes as a
comparison baseline. It does not claim local translations match them, run an
import, change a repository file, or grant permission to apply a future plan.
The target UI can load the current baseline and explicitly confirm acceptance of
a displayed verified snapshot. Stored bytes are admin-only and no-store.

### Accepted-baseline repository preview

Session admins can POST `expectedRevision` to a target's `/preview` endpoint.
This compares its accepted baseline, stored local branch/locale translations and
a freshly verified repository read. It does not accept caller file values.
Its fingerprint binds target coordinates/revision, baseline version/content and
local row generations. Missing or changed baseline/target fails closed. Preview
does not advance the baseline, import, push, save a sync record or authorize an
apply. Conflicts and deletions remain manual. The target screen compares these
three sources, shows missing versus empty values and manual-review rows, and pages
comparisons in groups of 50. This screen has no apply, import or push action.
Refreshing the comparison rereads the remote file.

### Repository comparison draft resolution

Session admins can POST `expectedRevision`, the reviewed `expectedFingerprint`
and explicit `choices` (`base`, `local`, `remote`) for every differing key to
`/api/projects/:projectId/sync/repository-targets/:targetId/resolve-preview`.
The server recomputes the accepted baseline, current stored local scope and fresh
verified remote bytes. Changed target/baseline/local row generation/remote bytes
return409; missing/extra/invalid choices return400. A selected missing value
omits that key from draft JSON only. Response includes exact JSON, SHA256 digest,
counts and comparison provenance, with `canApply=false`. No local import,
repository write, baseline advance or sync/diagnostic record. The target screen offers explicit selections for every differing key, draft
JSON/digest review and exact-byte download. Selections survive comparison pages;
changed selections discard the previous draft. A failed preparation requires a
fresh comparison. Neither preview nor draft preparation applies changes.

Repository draft responses also include `localChangePlan`: deterministic per-key
`set-value` or `remove-locale-value` changes from current local values to the
selected draft, with expected/next values and set/removal/unchanged counts. The
plan binds the reviewed fingerprint and exact draft digest. A removal is only a
locale value, never a project key or another locale. This is materialized review
data, not executable permission; no plan is persisted or applied. The draft UI
shows these local changes, current/draft values, explicit locale-only removal
scope, no-op state and independent 50-row pages.

Repository comparisons and draft local plans carry local preconditions from the
same repeatable-read snapshot: exact project/branch/locale, key identity/name,
key update generation/length limit and translation row identity/version/value
(or explicit missing translation). The complete local key set must match before
any future execution, including unchanged keys. Remote-only draft keys do not get
invented database identities. Key metadata changes invalidate reviewed fingerprints.
These are snapshot evidence only, not locks, reservations or apply permission.

An internal `lockLocalPreconditions` transaction helper validates that evidence
against locked existing key/translation rows under Serializable isolation. It
rejects changed scope, exact key set, key metadata, row identity/version/value,
newly created formerly absent translations and plural data. This helper has no
HTTP route or apply caller and does no writes. It does not reserve absent rows;
any eventual execution must authorize again, validate target/baseline and make
writes in the same Serializable transaction, handling serialization conflicts.

An isolated `writeExistingLocalValues` helper exercises same-transaction existing-
key locale sets/removals after locked precondition validation. It validates the
batch, resets review/MT for sets, increments version, and writes history/activity
atomically. Removal archives the exact row and full ordered history in a durable
project-owned deletion audit before deleting only that locale row. Audit survives
translation recreation and key deletion; project deletion removes it. History is
bounded1000 rows/512KiB; over-bound removal fails atomically, never truncates audit.
Unknown keys, duplicates, no-op and length violations are refused. This helper has
no production caller/public apply route, TM updates, webhook/automation delivery
or target/baseline authorization. Those remain integration work before execution.

Internal `lockRepositoryWriteScope` guards a Serializable transaction with locked
current project/admin membership, target revision/branch/locale and accepted
baseline version/SHA/digest. Revocation/baseline replacement waits until that
transaction ends; stale/new requests fail. This is a transaction guard only, not
an HTTP apply route, source of consent or complete execution service. The future
caller still needs session authorization, fresh reviewed remote/draft checks,
local preconditions, same-transaction writes and post-commit delivery handling.

Internal `repositoryLocalTransaction` composes reviewed draft byte/digest/fingerprint
binding, scope consistency, current locked admin/target/baseline guard and local
snapshot/write helper in one Serializable transaction. Operations are re-derived
from draft bytes, never supplied changes. Only existing keys supported, and a
successful write makes replayed local preconditions stale. It has no public caller
or fresh remote reader, TM update, webhook/automation delivery or sync-success
record. Transactional groundwork only, not complete sync/apply integration.

Existing normal save/import and isolated locale writer now share the same
transactional TM helper. Nonempty target saves remember the current nonempty base
source; base-locale/empty saves do not create or overwrite pairs. Locale removal
preserves historical TM, matching existing editing semantics. TM commits/rolls
back with locale value/history/activity. Webhook/automation delivery and the fresh
source/public execution composition are still outstanding integration work.
