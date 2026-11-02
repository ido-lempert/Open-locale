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

Internal reviewed repository transactions also persist one pending local-effect
intent per changed locale value in the same transaction, including operation,
exact set value (empty distinct from removal), actor/key/branch/target lineage and
reviewed digest/fingerprint. Rollback or failed intent storage rolls back local
writes too; no-op and stale replay enqueue nothing. These are private pending
facts, not delivery receipts or execution grants. There is no dispatcher, retry/
retention policy or public apply caller yet, and no webhook/automation is sent by
this code. Key/target deletion preserves lineage; project deletion removes payloads.

Internal intent queue bookkeeping now supports one-row SKIP LOCKED claims,
60-second token-fenced leases, at most three attempts and 30-seconds-per-attempt
retry backoff. Expired final attempts retire without returning work. Database time
controls eligibility and settlement; expired/wrong tokens cannot finish/requeue.
This is at-least-once groundwork, not exactly-once delivery: a crashed lease may
have performed an effect. No worker/dispatcher is enabled. A future handler must
check current routing/authority and use the intent ID for downstream deduplication.
Terminal bookkeeping is not a delivery receipt; terminal retention is still open.

New intent rows bind target revision and resulting translation row/version. An
internal Serializable eligibility guard locks and checks current actor admin,
project/target/key/branch/locale lineage, exact resulting value generation (or
continued absence for removal) and live lease token, rechecking expiry after lock
waits. Old intents without revision evidence fail closed. This is a point-in-time
internal guard, not a dispatcher or permanent grant; no network runs under locks.
A later change can still invalidate dispatch, and handler routing/deduplication,
terminal retention and public execution composition remain code work.

Internal terminal-intent cleanup retains seven days of completed/dead bookkeeping,
pruning at most100 old rows per call with SKIP LOCKED. Pending/leased intents are
never age-pruned, even when expired/exhausted. No payload is returned by cleanup.
This is an internal helper, not a scheduled cleanup or dispatcher; callers still
need to run it. Pending backlog limits, actual dispatch and public execution remain.

Reviewed local transactions reject new work before locale mutation when a project's
pending/leased backlog plus proposed changes exceeds10,000 intents or8MiB of key
names plus set-value UTF8 bytes. Expired/exhausted leased rows still count; terminal
rows do not. Serializable project locking prevents concurrent final-slot producers
from exceeding admission limits. No-op drafts remain usable. This is a pending
payload admission bound, not total database/storage accounting or enabled dispatch.

An internal single-step effect runner composes claim, Serializable current-context
validation, handler call after transaction/locks release, and token-fenced settlement.
No timer/startup worker or production webhook/automation handler is connected.
Ineligible contexts never reach a handler; handler failures use bounded retry,
and expired leases report stale rather than completed. Handlers must be bounded,
recheck current routing/authority, and deduplicate by intent ID. Crash/timeout after
an effect can cause retry; queue completed is bookkeeping, not delivery receipt.

An internal repository webhook adapter now revalidates current intent eligibility
immediately before the existing signed/DNS-pinned webhook pipeline. Receiver
payloads include effectId for downstream deduplication. Sets emit translation.updated;
removals emit translation.removed with null value (API subscription supported, no
new settings checkbox yet). Delivery returns aggregate matched/succeeded/failed;
failed receivers make the adapter throw for bounded queue retry. Other successful
receivers may receive repeats: this is at-least-once, not exactly-once. Existing
normal save/import delivery semantics stay fire-and-forget. No worker/startup timer,
automation handler or public repository apply is connected in this stage.

The explicit internal runRepositoryWebhookStep now joins one queue claim to current
eligibility, signed/pinned webhook delivery and fenced settlement. Real receiver
tests cover completed no-redelivery, exhausted failure/backoff and due retry with
stable effectId. No timer/startup worker/public route is connected. This helper is
webhook-channel-only; it does not execute automations or mark overall sync complete.
Before a production combined worker, per-channel completion needs separate state.

Repository delivery now rechecks current intent eligibility immediately before
each socket attempt, after DNS and after retry backoff. Target changes or expired
leases between receiver attempts suppress later sockets and journal only attempts
actually made. Guard transactions end before transport; this reduces stale retry
windows but cannot eliminate changes after the check. Normal non-repository callers
omit the optional attempt guard. No worker/public route is enabled.

The webhook pipeline now re-reads each captured subscription before every socket.
Disabled/deleted/unsubscribed hooks, destination edits and signing-secret changes
abort the captured delivery rather than sending to old or newly edited routing.
This also applies to normal callers. No lock is held during transport, so changes
immediately after the check remain a race; no stronger revocation guarantee is made.

Internal webhook steps persist webhookHandledAt independently of the queue state,
fenced by live lease token. A requeued intent with this checkpoint skips webhook
redelivery; failed receivers never checkpoint. This records handler completion,
including zero subscribers, not a receiver receipt or automation/sync completion.
A crash after a socket but before checkpoint still causes at-least-once retry.
No combined worker/public route is enabled; automation needs its own state.

Authenticated webhook updates increment a configuration revision. Captured delivery
checks that generation before each socket, so disable/restore and URL-edit/restore
ABA during backoff also abort the old retry even when final fields match. Direct
out-of-band database edits must maintain revision themselves; field comparisons
still catch non-restored changes. No exactly-once or post-check revocation guarantee.

Automation fire now returns matched/succeeded/failed/skipped bookkeeping while
normal callers remain fire-and-forget. Rule failures and caught per-locale MT errors
cannot count as success; notify receiver failure aggregate becomes failed run.
This does not add repository automation execution or exactly-once semantics. No
rules/zero subscribers are not delivery receipts. Activity write failure also fails
the rule summary even if a prior effect happened, so retries need deduplication.

An internal repository automation adapter revalidates intent before using the
existing translation.value trigger and awaited outcome summary. Existing main/base
bounds and creator permission checks apply. Empty set follows normal value-write
semantics; removal does not invent a value trigger. Failed rule summary throws,
but partial effects may already exist, so per-rule deduplication remains necessary
before production retries. No channel checkpoint/combined worker/public apply added.

Repository automation rechecks current intent before each rule, including after
a previous rule commits. Target change or lease expiry stops remaining rules;
already completed effects remain. This is not per-rule retry deduplication or
elimination of the race after a check. Normal automation callers need no guard.

Captured automation rules are re-read before execution; disabled/deleted/updated
rules abort remaining runs. Authenticated updates increment a revision, rejecting
edit/restore ABA even when visible configuration returns to its earlier value.
This point-in-time check does not fence edits after the check or deduplicate retries.

Automation notify carries current repository intent and captured rule guards to
each actual webhook socket attempt, after DNS and retry backoff. A target/lease/
rule change after a failed attempt suppresses another socket. Checks still have
a post-check race and do not supply per-rule retry deduplication.

Automation pretranslate rechecks current repository intent/captured rule before
each target locale. Revocation stops remaining locales, preserving prior committed
fills. This is not a check inside the MT write transaction or a rollback of earlier
locales, and does not provide per-rule retry deduplication.

Repository automation also supplies an optional MT pre-write guard after provider
computation and before opening its write transaction. Stale context discards computed
results without translation/history/MT activity writes. A post-check race remains.

An explicitly invoked internal automation-channel step persists an independent
lease-token/deadline-fenced handled timestamp. Checkpointed requeues skip automation
replay; failed runs cannot checkpoint. Crash before checkpoint can still duplicate
effects. This is not webhook/overall sync completion or an enabled combined worker.

An explicit internal combined step runs webhook then automation under one lease,
with independent channel checkpoints. If automation fails after webhook handling,
a due retry skips that webhook channel. No timer/public apply is enabled; this
bookkeeping does not make partial rules replay-safe or establish sync acceptance.

Successful repository automation rules have intent-scoped, live-lease-fenced
checkpoints. A partial retry skips previously checkpointed rule IDs even after
a rule edit or task closure. Crash between effect/activity and checkpoint can
still duplicate effects; this is not atomic exactly-once execution.

Rule checkpoint writers lock the intent before checking the live token/deadline,
so a blocked writer cannot record success after reclaim or expiry. Ledger rows
cascade with their intent. Effects before checkpoints still have a crash gap.

Both channel checkpoints share a lock-before-clock helper. Blocked writers recheck
current token/deadline after contention; existing timestamps cannot be overwritten.
This does not change the effect-before-checkpoint crash gap.

First repository automation dispatch freezes eligible rule IDs under the intent
lock. Later-created rules cannot join that intent on retry. Current enabled/revision
checks remain; failed selected rules may use current configuration on a later retry.

Repository rule selections are bounded to1000 unique UUIDs. Malformed/oversized
stored manifests fail closed; an empty frozen selection never widens to all rules.
Selection reads stop at1001 rows and reject overflow before persisting a manifest.

Repository effect processing can be opted in with
`REPOSITORY_EFFECT_WORKER_ENABLED=true` (default OFF). It handles one intent per
5-second tick without overlapping local ticks;leases coordinate processes. Shutdown
stops new ticks and awaits in-flight work on SIGTERM/SIGINT before disconnecting
the database. Container termination grace must allow the drain; forced kill may
interrupt work. It does not expose public apply or write
remote repositories. Crash gaps still permit duplicate effects.

Internal fresh-source local execution now recomputes repository preview/resolution,
checks the reviewed fingerprint and exact draft digest, and runs the existing
Serializable local write plus history/TM/intents. The internal service is also exposed by the reviewed local-only endpoint below. Only
existing-key locale set/removal is supported; remote-only new keys fail closed.
It does not advance the accepted baseline, write remote files, or accept a sync.
Remote bytes are fresh at read time, not locked against later repository changes.

`POST /api/projects/{projectId}/sync/repository-targets/{targetId}/apply-local`
now exposes that local-only write to signed-in project admins. Send the reviewed
`expectedRevision`, `expectedFingerprint`, `choices`, and `expectedDraftDigest` from
resolve-preview. The service rereads all sources and commits atomically or rejects.
The web screen offers a separate reviewed local-apply confirmation. This endpoint does not enable the default-off
effect worker, push repository files, advance the baseline or accept a sync.

The repository target screen can now apply a reviewed existing-key local draft.
Prepare the exact JSON first, then review a separate confirmation with project,
branch, locale, set/removal counts and digest. Cancel leaves local values unchanged.
Success or failure clears stale review and requires a fresh comparison. A lost
response may hide an already committed write, so the UI never offers blind retry.
Configured downstream effects may run later if the deployment worker is enabled.

Local apply reports expected denials without a generic server error: unsupported
operations or local limits return 400; changed locked scope, a full effect backlog
or a serialization conflict return 409 and require a fresh review. Unexpected
storage faults remain 500 and roll back the transaction. No automatic retry.

The local apply conflict path is tested against an actual PostgreSQL concurrent
update after the Serializable snapshot. Raw locking SQL can report Prisma P2010
with SQLSTATE 40001; that exact case returns 409 without retry, like P2034.

Local apply sets a transaction-local PostgreSQL lock timeout of two seconds per
lock wait. Actual project-row and translation-row contention return a safe 409
without retry or partial write. This bounds each lock wait, not the entire request
or all cumulative waits; other unexpected transaction failures remain 500.

Terminal repository-effect retention can be opted in separately with
`REPOSITORY_EFFECT_RETENTION_ENABLED=true` (default OFF). It deletes at most 100
completed/dead intents older than seven days per minute per process, including
their rule checkpoints. It never age-prunes pending/leased work. Retention alone
does not dispatch effects. It shares the worker's non-overlap and shutdown drain.

Retention uses a terminal-only partial PostgreSQL index on `(finishedAt,id)` and
one database wall-clock cutoff per sweep. The planner chooses its own path; this
does not impose a total runtime bound. The index migration is a normal transactional
CREATE INDEX, not concurrent: plan a maintenance window for a large existing table
because writes can wait while it builds. Prisma schema cannot encode this partial
predicate; preserve the SQL migration in deployment history.

Session project admins can read
`GET /api/projects/{projectId}/sync/repository-targets/{targetId}/effects-summary`.
This no-store endpoint returns pending/leased/completed/dead counts, expired lease
count, oldest pending timestamp and database as-of time. It includes all historical
revisions of that target, not only its current coordinates. Seven-day terminal
retention can remove older completed/dead counts. It returns no translation payload,
actor, lease token or raw error and never dispatches or retries work. Counts are
handler bookkeeping, not delivery receipts or accepted synchronization; it does
not infer worker enablement. The target screen offers a manual Load effect summary action. It does not poll,
retry or dispatch work. Refresh clears prior counts while loading and on failure;
project navigation drops late responses. The displayed snapshot is not live.

Repository effect eligibility validation also sets a transaction-local two-second
lock timeout before locking intent/project/member/target/key/translation scope.
Contention aborts validation without invoking the handler; the runner uses its
existing bounded retry bookkeeping. This applies to handler revalidation too,
including checks before webhook socket attempts. It bounds each lock wait, not
claim, settlement, transport, cumulative validation time or the full worker tick.
No lease renewal or exactly-once delivery promise is added.

Rule and channel checkpoint writers also set a transaction-local two-second lock
wait timeout before locking the intent. A timeout never stores checkpoint success.
Effects may already have happened before that checkpoint failed, so retries can
still duplicate uncheckpointed work. This bounds each checkpoint lock wait, not
all worker database work, delivery, settlement or shutdown drain.

Effect settlement explicitly locks the intent before evaluating the current lease
token and database deadline, with a transaction-local two-second per-lock timeout.
A token change or expiry while waiting cannot record success; lock timeout leaves
lease state untouched for later recovery. This does not bound the full runner or
close the effect-before-settlement crash gap.

Due retention is attempted even if that tick's effect step throws. Both opt-ins
remain independent,share non-overlap/drain,and keep the one-minute per-process
cleanup attempt cadence. A long-running effect still defers cleanup; this is not
a real-time deadline or a promise that a failed database can complete cleanup.

Manual effect summary also shows aggregate webhook/automation/both channel
checkpoint counts across every queue state. A pending retry can already have a
handled webhook channel. These timestamps mean handler bookkeeping, not receiver
receipts or successful sync. Retention can remove these counts with terminal rows.

If shutdown starts while an effect is in flight, the worker drains that effect
but does not start a new due cleanup afterward. Cleanup already in flight is
still awaited. This does not add a hard shutdown deadline or cancel a transport.

New local removal intents bind a durable project/key/locale deletion generation to
that transaction's deletion audit UUID. A recreate-then-remove cycle replaces the
marker, so an older intent cannot become eligible merely because the value is
absent again. Legacy removal intents without this marker fail closed. Marker and
intent roll back with the deletion audit; project deletion cascades markers. No
new remote write or exactly-once delivery guarantee is added.

Session project admins can read `GET /api/projects/{projectId}/sync/deletion-audits`
for pages of up to 50 deletion audit metadata rows, ordered newest timestamp/ID first.
Pass returned `nextCursor` as `?cursor=...` for older rows; null ends the list.
Keyset cursors remain valid after boundary-row deletion and newer inserts, but are
not frozen snapshots: concurrent older inserts/deletions can change later pages.
It includes audit/key IDs, key name, locale, actor ID and timestamp only, never the
stored translation/history snapshot. Metadata survives key deletion. This no-store
read does not restore/delete anything or grant restore permission. Repository targets screen manually loads project-wide metadata pages with explicit
older-page navigation,empty/error states,and navigation stale-response clearing.
Loading is announced;successful page replacement returns keyboard focus and viewport
to the audit heading. Failed or obsolete requests never move focus.

Audit metadata pages use a project/timestamp/UUID ordered index. PostgreSQL chooses
its query plan; the index does not impose a total runtime bound. The migration uses
transactional CREATE INDEX then drops the redundant project/timestamp prefix index.
Plan a maintenance window for a large existing audit table: writes can wait while
the index builds. Existing audit metadata and stored snapshots are not rewritten.

Internal deletion recovery diagnostic validates bounded flat snapshot scope,current
key/name/length/locale,current absence and exact removal generation. It returns a
value digest,never archived bytes or execution authority. No HTTP recovery endpoint,
restore writer or history replay exists;future execution must re-authorize/revalidate.

Internal recovery lock guard requires Serializable isolation,current team admin and
locked project/audit/key/locale/removal-generation/current-row revalidation against
the reviewed value digest. Per-lock timeout is two seconds,not a total request bound.
No restore writer or HTTP endpoint. Future writes must stay in the same transaction;
row locks cannot reserve an absent translation,so serialization handling is required.

Isolated internal recovery writer now creates a fresh UNVERIFIED row,new history
event,safe activity and normal TM pair inside that guarded Serializable transaction.
It never upserts/overwrites,replays old history/status/MT provenance or deletes the
audit. It clears the old removal marker. No public recovery endpoint/UI or repository
effect composition exists;the building block is exercised only by local tests.

Recovery concurrency tests observe actual PostgreSQL lock waits for competing
Serializable recoveries and a normal locale creation. The losing stale transaction
fails serialization (competing recovery) or the exact key/locale unique constraint
(normal creation),without recovery success or duplicate history/activity. No
automatic retry of the stale review is added.

Internal recovery also binds the reviewed branch UUID and locks that project branch.
A key moved to another branch or a deleted/mismatched reviewed branch is rejected,
even when archived value digest still matches. No public recovery surface is added.

Session admins can inspect `GET /api/projects/{projectId}/sync/deletion-audits/{auditId}/recovery-preview`. The no-store read returns
current eligibility/reason only,never value/digest/history or restore authority.
It uses a consistent RepeatableRead snapshot,holds no reservation,and cannot promise
that eligibility stays valid. canRestore=false;no public restore mutation/UI.

Audit cards now offer an explicit read-only eligibility check with fixed plain-language
reasons,current-only/no-reservation warning and no restore action. Page refresh or
navigation clears previous eligibility;failed checks hide stale results and raw errors.

Eligibility preview includes the database transaction snapshot timestamp (`asOf`);
the card shows that UTC timestamp instead of an aging "just now" claim. A new check
gets a new snapshot,not a reservation or live status.

Internal recovery binds reviewed key updatedAt as well as branch/value digest.
A changed timestamp invalidates old review even when visible fields return to prior
values. This timestamp is not a monotonic generation:edits sharing the same stored
timestamp cannot be distinguished. Public eligibility exposes no key timestamp/token.

Key revision is now database-owned: an UPDATE trigger advances it from the old
value, including raw SQL and attempted resets. Internal recovery binds this revision
as well as timestamp/branch/digest, closing the same-timestamp metadata-change gap
for ordinary writes. Rollbacks roll back the revision too. No-op updates also
invalidate review;integer overflow fails closed. Privileged schema/trigger tampering
is outside this guard. Additive migration takes a keys-table lock: schedule a
maintenance window for a populated deployment. No public recovery token/restore API.

Internal recovery guard and writer copy primitive scope bindings before awaiting
locks. Caller mutation cannot change the reviewed project/actor/audit/revision while
the transaction waits. This is a binding guard,not authorization to execute recovery.

Recovery eligibility rechecks project membership and effective direct/group admin
role inside the same RepeatableRead diagnostic snapshot,not only before it starts.
Revocations committed before that snapshot deny the result. Later revocations do
not rewrite an already-started snapshot;this remains read-only,not a reservation.

Deletion-audit metadata pages also recheck effective direct/group admin within the
same RepeatableRead snapshot as their bounded page query. Committed pre-snapshot
revocations deny metadata;separate page requests are not one frozen snapshot.

Internal recovery guard accepts effective group ADMIN as well as direct admin,
while requiring current team membership. It locks matching group grant/role rows
with the same per-lock timeout;revoked grants fail closed. No public restore action.

Recovery direct-admin authorization depends only on its locked team grant,not
unrelated group rows. Group-derived authorization locks matching ADMIN grants,
not MEMBER groups that cannot authorize recovery. Required grant contention still
fails closed;multiple matching ADMIN grants are conservatively all locked.

Recovery diagnostic applies its512KiB serialized-JSON bound in PostgreSQL CASE
projection before transferring archive bytes to the API. PostgreSQL still evaluates
serialized size;this is not a database CPU/storage bound. JSONB text whitespace
counts toward the limit,so near-boundary archives may be conservatively rejected.

Explicit session admins may GET /api/projects/{projectId}/sync/deletion-audits/{auditId}/recovery-value-review
to review an eligible archived flat value,up to32768UTF8bytes. Separate from value-free
eligibility/metadata,no-store,same-snapshot effective admin;denied/oversized value is
null. Empty value is supported. No history,full snapshot,internal binding token,
reservation or restore action. This route exposes private translation text only to
the existing project-admin audience;no sharing is performed.

Audit cards now offer explicit Review archived value and Hide archived value
controls. Text is escaped,scroll-bounded and manual-only;UTC snapshot/not-live/no-
restore notice stays visible. Page refresh,navigation,eligibility check or failed
review clears prior private text;late replies cannot cross projects. No restore UI.
