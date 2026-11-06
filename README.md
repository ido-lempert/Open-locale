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
that eligibility stays valid. canRestore=false;this preview does not mutate. Separate explicit recover-local API now exists;no restore UI action.

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
with the same per-lock timeout;revoked grants fail closed. No restore UI action.

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

Pending archived-value review announces loading and offers Cancel value review.
Cancel hides late responses and releases controls;it does not claim to abort the
network request or erase its response from browser memory/history.

Archived-value result lands keyboard focus on its labeled region. Hide/cancel
returns focus to the originating review button after render;generation fencing
prevents superseded navigation/actions from stealing focus.

Eligibility,value-review and deletion-audit page transactions set PostgreSQL READ
ONLY before snapshot authorization. Accidental SQL writes fail25006 instead of
mutating data. This database guard complements,no-store/session/admin controls;it
is not a substitute for authorization or proof that other routes are read-only.

Internal recovery composition now commits a guarded fresh row and one generation-bound
repository effect intent atomically under current target/baseline scope and pending queue
budget. At review0216 there was no public restore route/UI, fresh GitHub read, worker enablement, remote write
or baseline advance. Composition currently requires direct team admin. See review0216.

Recovery composition now has actual PostgreSQL contention tests for both mutable
caller scopes,project/target/baseline lock timeouts and competing recoveries with
one committed effect intent. At review0217 there was no public restore execution.

Recovery-created intents now pass actual signed HTTP receiver and task automation
through the combined internal step,checkpointed requeue and superseded-generation
denial. No worker enablement or public restore execution. See review0218.

Internal target-scoped recovery review now derives current audit/key and repository
target/baseline bindings in one DB-enforced read-only snapshot,with direct-admin
authorization and bounded value review. No public route or restore grant. See review0219.

Internal authenticated recovery execution now binds session/project/target/audit
and captured reviewed scopes before one Serializable composition transaction,with
no retry and actual rollback/replay tests. At review0220 there was no public restore route/UI.

Separate target-scoped read-only recovery review GET exposes bounded archived value
and current review bindings to session direct admins,with UUID/no-store/denial
privacy tests. At review0221 there was no execution route or UI consumer.

Archived review UI now explicitly chooses value-only or selected repository target,
shows target/snapshot limits,and clears/fences private text when scope changes.
Read-only,no restore action. See review0222.

Target recovery review now selects only required baseline scalar bindings,not unused
baseline text;actual Prisma SQL/result projection tested with a large private
baseline fixture. No API/UI contract change. See review0223.

Recovery-review actor binding: target-scoped read-only review captures the original
session actor before authorization yields. Actual PostgreSQL preflight/snapshot
mutation cases and an old-code negative control are recorded in review0224.

The shared repository write-scope guard owns its reviewed scalar bindings before
any database await; real PostgreSQL mutation cases are recorded in review0225.

Local precondition validation captures nested key/translation generations before
async database work; stale review cannot be repaired by mid-call caller mutation.
Real PostgreSQL controls are recorded in review0226.

The shared local writer captures its nested snapshot and changes at entry, keeping
value/history/activity bound across async work; PostgreSQL controls in review0227.

Internal recovery execution has typed400/409 denial handling,including actual
PostgreSQL lock/serialization tests;unknown faults remain faults. See review0228.

### Explicit local archived-value recovery API (review0229)

POST `/api/projects/{projectId}/sync/repository-targets/{targetId}/deletion-audits/{auditId}/recover-local`
requires a signed-in direct team admin,`confirmation: recover-local-value` and
reviewed `expectedBranchId,expectedKeyUpdatedAt,expectedKeyRevision,expectedValueDigest,
targetRevision,branch,locale,baselineVersion,baselineSha,baselineDigest` from the
separate target recovery review. Session/path supply actor/project/target/audit.
One Serializable transaction revalidates all bindings and current absence,then
creates a fresh unverified locale value,new history/activity/TM and one pending
effect intent. Archive retained,no history replay. Stale/replay/busy/backlog409,
malformed/unsupported400,unexpected fault500 with rollback. No retry/fresh review,
remote read/write,baseline advance or accepted sync. Worker remains defaultOFF.
At review0229 no restore UI action existed;review0235 adds separate target-scoped prepare/confirm. Earlier review notes describe
the surface at their respective milestones,not the current API inventory.

Recovery API HTTP failure/race evidence (review0230):actual project-lock busy409,
real intent-insert database fault500 with complete rollback/private-error hiding,
and competing HTTP requests with one committed value/history/activity/intent.
No app change or remote-delivery claim.

Explicit local recovery enforces the same32768UTF8byte archived-value bound as
review,inside its transaction. Correctly forged bindings cannot bypass this bound;
exact-bound multibyte success and over-bound400/rollback tested in review0231.

Recovery HTTP tests now commit actual target/baseline/key/deletion-generation/
existing-value changes after review,then prove409 preserves exact pre-execution
state without refreshing the stale request. Tests only;see review0232 and its
negative-control limitation.

Actual recovery HTTP revocation tests reuse the original session/review after
committed admin demotion/removal;wrong-project and missing target/audit paths
also deny without recovery effects/private archive disclosure. See review0233.

Recovery HTTP tests observe actual PostgreSQL project-lock waiters before admin
revocation commits,then verify409/no partial recovery for demotion/removal using
the original session/review. Tests only;see review0234.

### Separate local recovery UI confirmation (review0235)

Select a repository target for archived-value review,then Prepare local recovery.
Review the local-only/queued-effect warning and explicitly confirm,or cancel.
Value-only reviews cannot recover. Private review/bindings clear before sending;
errors never retry automatically and warn that a lost response may hide a completed
write. Check the current value and get a new review before another request. Success
lands focus on outcome. No remote write/baseline advance/sync acceptance or enabled
worker. Older no-UI notes describe their historical milestone.

Recovery browser tests also cover a real successful local commit whose response is
replaced by503 before reaching the browser. The UI warns that the value may have
changed,sends no automatic retry,and a fresh review cannot recover an existing
value. This does not promise exactly-once external effects. See review0236.

While local recovery is pending,the focused notice says leaving does not cancel
its request. Route changes clear pending/private review UI and fence late outcomes
and focus. A browser test holds a real committed201 response across same-component
project navigation and verifies one persisted value/history/intent with no old
project status or focus crossing the route. Check current value after returning;
this is not a durable background outcome notification. See review0237.

Refreshing repository configurations immediately clears archived private review,
prepared recovery bindings and eligibility preview,even if the refresh fails or
returns unchanged target revisions. Select the target and review again before
preparing recovery. Metadata remains available. See review0238.

Configuration save/removal also clears private archived review/prepared recovery
before its request,even if it fails. Refresh/save/remove share this cleanup;new
explicit review required. Busy/unconfirmed actions do not cancel pending work.
See review0239 for unit success/failure and actual browser removal evidence.

Successful configuration save also has real browser boundary coverage:prepared
recovery clears before held PUT completes,committed coordinate revision invalidates
baseline without locale/history/queue writes,and new review exposes no value or
prepare control until a baseline is available. See review0240;fixture restoration
for later tests is not a baseline-acceptance UI claim.

Denied archived-value reviews now show fixed reason guidance for missing current
baseline,target/scope mismatch,existing value and supported audit/key/locale/size
limits. Unknown reasons remain generic,not raw server text. Existing value is never
overwritten by recovery;missing baseline requires separate review. See review0241.

Prepare local recovery now lands keyboard focus on its confirmation region;Cancel
returns focus to Prepare. Delayed focus is fenced by generation,audit and current
confirmation state so old review callbacks cannot steal focus. See review0242.

Recovery confirmation and outcome now show explicit visible keyboard-focus outlines.
Actual browser Tab/Enter traversal verifies Confirm then Cancel,return to Prepare
and no recovery effects from keyboard cancel. See review0243.

Accepted comparison-baseline and local-apply requests now clear private archived
review/prepared recovery before awaiting results,including unknown failures. Fresh
review required after either local write. Actual held baseline POST verifies this
alongside version+1 and no locale/history/queue mutation;local-apply cleanup is unit
covered. Baseline acceptance remains comparison-only. See review0244.

Actual browser local apply now covers a coexisting prepared archived recovery:
private review clears before held apply response,and only reviewed existing value/
new history/one intent commits. Deleted archived value remains absent. This closes
the unit-only boundary noted in review0244. See review0245.

Denied archived-review responses discard value bytes before component state storage,
even if an inconsistent response includes them;no recovery bindings are extracted.
Target and value-only state tests plus browser denied-payload handling cover this.
This is not network/runtime memory erasure. See review0246.

Client archived-review display also requires literal available=true,a string value
and at most32768UTF8bytes before storing value/extracting recovery bindings. Empty
and exact boundary values work;malformed/oversized responses stay unavailable. This
is not a network preparse bound or memory erasure. See review0247.

### Webhook delivery journal
Project admins can open **Delivery journal** beside a webhook in project settings.
It is a read-only snapshot of up to 50 recent delivery records, with event, HTTP
status (or unavailable), attempt count, duration and timestamp in the browser's
local timezone. Use **Refresh deliveries** to read again. Payloads, signing secrets
and raw transport errors are not displayed. A successful HTTP response does not
prove receiver-side processing. There is no resend action, continuous watch or
full-history view; this UI does not enable the repository effects worker.

### Recorded automation activity
The Automations panel links to project Activity. Choose **ran automation** to see
recorded rule names and known action types. **Recorded error** means an error field
was recorded at the top level or for a target locale; other records say **outcome
not confirmed**, not success. Raw errors and notification messages are omitted.
This best-effort feed is not a complete run history or receiver receipt, and it
does not offer retries or enable a worker.

### Inspect retained OTA publications
In project settings, use **Inspect** beside a publication locale to view that
retained branch/version/locale. This is published content, not live editor values;
empty and unreviewed translations can be present. Local pages render 50 values at
a time, but the full bundle is downloaded. Refresh reads again without publishing.
Up to 25 versions are kept per branch. New Inspect links pin the publication UUID and fail if that retained publication
is gone, even if branch recreation reuses the version. Legacy unpinned links keep
branch-name/version lookup and show a warning; use a fresh Inspect link to pin it.
Pins do not extend retention or provide permanent archival storage. This view does
not verify a client received the bundle, check its integrity digest, or add CDN or
native mobile delivery.
The inspection search finds literal substrings in published keys or values in the
currently downloaded locale, ignoring case and preserving whitespace. It makes no
new API requests. Clear restores all values; changing publication scope clears the
search. Paging is local to the matches. Search does not cover other publications
or locales, and no matches does not mean the publication itself is empty.

### Web build delivery
Secondary screens load as separate route chunks; login, callbacks, project list
and editor remain in the entry bundle. The production initial build is405.86kB
in this slice, below the unchanged500kB warning budget. This does not reduce all
visited-screen downloads by the same amount. Deploy the entire build together,
and retain old hashed assets long enough for already-open clients to navigate.
Navigation errors show fixed guidance to preserve unsaved work before refreshing
or choosing another link. The app never automatically reloads. This is feedback,
not automatic retry or recovery from a removed stale chunk.

Editor key history now keeps pending/error/empty states distinct, with a manual retry. Old history reads cannot overwrite a later selected key or reopen a closed pane; list reload and leaving the editor invalidate that pane. This does not add history mutation, cancellation, or editor-wide draft/list race recovery.
Screenshot context now waits for all authenticated image reads before publishing the pane, keeps failed reads distinct from an empty list, and offers manual retry. Closing/replacing/leaving the pane releases its owned blob URLs. Confirmed screenshot uploads/deletes refresh only a still-selected pane instead of reloading all translation drafts. Requests are not canceled, and concurrent editor mutations are not an exactly-once recovery workflow.
Comment threads keep failed reads separate from empty threads and support manual retry. Old selected-key reads and completed post/delete refreshes cannot replace another selected thread. Confirmed comment writes no longer reload translation drafts; a newer same-thread comment draft is retained. One comment mutation is allowed in flight per editor. Failed write responses remain outcome-unconfirmed, not safe-to-repeat guarantees.
Editor key-list reads accept only the latest requested result, including search changes before debounce. Pending/failed reads retain the previous grid read-only with explicit guidance. Failed reads offer manual retry and selectable retained local values outside the disabled grid, so they can be copied first. A successful retry replaces the grid with current server values; this is not draft merge, saved-data export, request cancellation or editor-wide mutation recovery.
Translation-memory suggestions now clear on a new cell read or edit and require the same source plus an empty target before applying a currently shown option. Delayed/refocused reads cannot overwrite a newer choice or typed target. Failed memory reads offer manual retry; suggestions can be chosen with keyboard Enter or a click and still save through normal unverified translation handling. This is local project translation memory, not an external machine-translation provider or a quality guarantee.
Editor translation text/form saves now include the loaded row version and immutable identity, using the existing conditional-write API. Another editor's newer content or a recreated row cannot be silently overwritten by a stale loaded cell. Failed or unknown save responses retain local values and stop blind replay; copy retained values before explicitly reloading, then edit against current data. This does not add status-write concurrency protection, definitive failure detection, automatic reconciliation or retry/idempotency guarantees.
Single-cell review changes now use loaded version and immutable row identity too, so stale editors cannot approve unseen newer wording. Review controls are disabled while that cell has unsaved content or a pending content/review write, or no saved row. The status API accepts optional conditional fields, checked with its history write under a row lock; existing clients without them remain compatible. Bulk review and outcome reconciliation are separate workflows.
A dirty translation cell now offers Save draft as an explicit alternative to blur-saving. It stays disabled while content or review is pending, after an unconfirmed result, or while the grid read is unusable. Text typed during a pending review remains local; once the review settles, Save draft uses the newly confirmed conditional baseline. No automatic replay or background draft persistence is added.
Project opening now distinguishes loading from failure, with fixed access/connection guidance and a manual Retry project action. Required project and branch metadata publish together; failed bootstrap never exposes a partially loaded editor. Late metadata/glossary responses cannot update a destroyed or superseded bootstrap. Optional glossary failure remains non-blocking. This does not add automatic retries, request cancellation, draft restoration or project-id route-reuse handling.
Project list and two-factor status now load independently, with separate fixed failure messages and manual retry actions. Pending or failed list reads never report an empty account; status failure never implies two-factor is disabled. A successful read of either remains usable when the other fails. Late/superseded read results are ignored after replacement or leaving the page. Project-list refresh after creation does not refetch account security status. Read retries do not change security settings; mutation outcome recovery and request cancellation are separate concerns.
Content-save handlers also reject pending/failed key-grid state before touching cells, even if a retained input event reaches the handler despite the grid being inert. Local text remains available for copying before an explicit reload. This guard stops new content requests; it does not cancel a write already sent or reconcile drafts with a later successful list replacement.
Bulk review now blocks while local translation values/forms differ from their confirmed baseline, cell content/review work is pending, or grid/cell results need reloading. Preview rechecks current scope and local readiness before confirmation and write. Single-cell content/review requests pause during bulk review. Text typed during a submitted bulk write stays local; completion marks cells for copy/reload instead of replacing drafts. An unknown bulk result also requires explicit copy/reload before another attempt. This does not add bulk row-identity CAS, cancellation, automatic replay, or general protection from unrelated editor mutations.
An empty filtered editor now says no keys match on the selected branch, rather than claiming the project has no keys. Clear key filters explicitly removes search, tag and status filters and reads again on the same branch and import/export locale. With no key filters, empty guidance identifies the selected branch. It does not count other branches or bypass permissions, and pending/failed reads still never count as empty success.
Confirmed tag edits now update only the loaded key's returned tags instead of reloading all translation cells. Pending same-key tag work is guarded and shown inline. Unconfirmed tag outcomes show fixed guidance, not raw service errors. Under an active tag filter the current row stays visible to protect local drafts; run the filter again for current matches. This does not add tag compare-and-swap, request cancellation or exactly-once mutation recovery.
Empty-branch creation now guards a pending request while leaving the branch-name input editable. A newer name draft survives an earlier create response. Confirmed creation is reported before an independent branch-list refresh; failed refresh has its own manual list-only retry and does not relabel creation as failed. Current branch and translation cells are not replaced. Unconfirmed create outcomes retain the input with fixed check-list guidance, without automatic replay. This does not add exactly-once creation, request cancellation or general mutation recovery.
Confirmed key creation now inserts only the returned new key into a still-current unfiltered grid, without reloading existing translation cells. Pending creation guards duplicates and keeps a newer key-name draft. Filtered, loading, failed or replaced-grid completion stays confirmed with branch-specific copy-first guidance, without injecting a mismatching row. Unknown creation uses fixed branch-specific feedback, no automatic replay. This does not add exactly-once creation or protect drafts from unrelated editor mutations.
Confirmed Add locale now appends only the returned locale to current project metadata without refetching project data or replacing translation cells. One locale addition is pending at a time; a newer code draft survives. Existing locale responses do not duplicate columns. Superseded bootstrap/destroy responses cannot update metadata; unconfirmed addition keeps fixed check-settings feedback without automatic replay. New cells are not proof of absent server translations: conditional saves still require the current baseline, and refreshing current server values remains explicit.
Confirmed key deletion now removes only that key and its local cells instead of reloading unrelated translation drafts. Deletion is blocked when the target has local unsaved/pending/unconfirmed translation work or pending tags, and while bulk review is pending. The deleting row is inert; content/review/tags and bulk review cannot start across pending or unknown deletion. Unknown results retain the row with fixed copy/reload guidance and block blind delete replay until an explicit list read. This is not server-side deletion compare-and-swap, cancellation, or general recovery for all editor mutations.
Branch-merge previews now accept only the current branch/list generation. Branch switching, list reload or cancellation invalidates an older preview. Preview and merge requests have pending guards, confirmation/cancel disable while a merge is sent, and failures use fixed feedback. Confirmed merge keeps the current source grid and local drafts instead of reloading it; main receives saved server values only, as the preview now states. Unknown merge closes the old prompt with check-main guidance, not automatic replay or outcome reconciliation. Changing scope suppresses late result UI, not the already-sent server operation.
Single-file imports and previews now capture branch, locale, format and grid generation before reading bytes. A newer file pick, scope change, list read or leaving the editor invalidates an older read/conflict/result. Pending requests guard duplicate single-file picks, and scope changes never retarget or cancel a request already sent. Late responses cannot publish feedback or reload a changed scope. File/read/preview/unknown-write errors use fixed guidance. Successful clean same-scope imports still explicitly refresh the grid. General concurrent-mutation reconciliation remains separate.
Real single-file import also blocks unsaved, pending or unconfirmed local translation work before submission, while read-only preview remains available. Submitted import pauses content/review/bulk handlers. If local text changes during a confirmed import, the grid stays with those values for copying before an explicit server reload instead of being replaced. Unknown submitted outcomes require an explicit read before another real import. A local JSON parse failure sends nothing and does not freeze the grid. Cancellation, automatic reconciliation and broader concurrent mutation handling are separate.

Bundle import shares the single-file pending boundary and captures branch, format, locale and grid generation. Existing dirty/pending/unconfirmed local work blocks a real bundle write. New drafts typed during a confirmed write stay local with copy/current-read guidance rather than a destructive refresh. An unknown submitted result warns some locales may have changed and requires an explicit current read before retrying. Per-locale partial outcomes are still independent, not rolled back. Scope changes do not cancel requests already sent.

Editor exports now share one pending request guard across single-file, zip and TMX downloads. Branch, locale or format changes discard a pending download and its feedback, without canceling the server request. File names use captured request values; export errors are fixed and separate from import/draft guidance. Exports contain saved server values, never unsaved local drafts or just the filtered grid. TMX contains project-wide translation memory for the selected locale, not a branch-only view. This does not confirm a browser saved the file, add request cancellation or retry automatically.

Screenshot upload/delete now share a per-key pending boundary and fixed unknown-result guidance. Duplicate changes and key deletion stay blocked while screenshot work is pending or unconfirmed. Closing the pane does not cancel or reopen a submitted change. A successful full current screenshot read, including image bytes, unlocks another change and corrects the count; failed reads do not. Confirmed writes and a failed refresh remain distinct. No translation-grid reload or automatic replay is added; unknown state does not survive leaving the editor.

Comment post/delete unknown results now block another change to that key until a later successful current-thread read. Fixed thread-local guidance keeps the draft available; failed reads do not unlock replay, and a read begun during a pending write cannot clear its later unknown result. Closing the thread does not cancel writes or persist cross-thread drafts. Confirmed post still preserves a newer same-thread draft, and confirmed writes remain separate from refresh failures. No automatic replay or translation-grid reload is added; unknown state does not survive leaving the editor.

Translation-memory apply now checks target readiness before changing local text. Dirty plain/plural values, pending save/review/import/bulk work, unknown results, unavailable grid or pending/unknown key deletion disable the offered choice and block its handler. Local text and offered options remain untouched when blocked. Once ready, an explicit selection still uses the normal conditional save; no queued application or automatic replay is added.

Task creation now shows a confirmed receipt before refreshing the current filtered list. It names the submitted task and explains that assignee/status filters can hide a new task. A failed list read leaves that receipt and any newer form draft intact; retry reads without creating again. Filter changes and read retries retain the receipt, while a new create or project visit clears it. This does not add idempotent create, automatic replay or a receipt that persists across navigation.

Glossary Add term now inserts only the confirmed returned term instead of reloading all translation fields. Existing local values, pending translation saves and a newer new-term draft stay intact. A changed, loading or failed list is kept with copy-first explicit refresh guidance. The receipt names the submitted term; another create or project visit clears it. Explicit Refresh still replaces translation fields with saved server values. This does not add idempotent creation, automatic replay, a durable receipt or general concurrent-mutation reconciliation.

Glossary Delete term now removes only the confirmed row without reloading unrelated local translations or pending saves. An unconfirmed delete keeps its row and blocks its save/delete controls until an explicit successful current glossary read. Copy local drafts before Refresh, which still replaces fields with saved server values. Failed reads do not unlock replay. This does not persist uncertainty across navigation or provide exactly-once deletion.

For bounded native verification, `VISUAL_STAGE=first`, then `middle`, then `tail` can share a private `VISUAL_CHECKPOINT_DIR` and optional `VISUAL_TEST_PG_PORT`. This retains all 242 unique native checks, with 246 total including four repeated startup checks. The existing first/second and uninterrupted paths remain available; completion of a checkpoint stage alone is not a full-suite pass.

New project now guards duplicate submission in its handler and shows a named confirmed receipt before refreshing the project list. Failed list reads leave that receipt and the whole newer form draft intact; Retry projects reads without creating again. A new attempt clears the old receipt, while an unconfirmed create keeps the form with check-before-retry guidance. No automatic replay, idempotent creation or receipt across navigation is added. Two-factor settings are unchanged.

Snapshot Restore now requires the exact selected row from the current usable list before confirmation and again before sending. Loading or failed reads, replaced rows, capture/restore pending state, leaving the page or a changed project/read during confirmation block stale handlers. A fresh selection still shows the full destructive warning. This does not cancel a submitted restore, check remote existence at click time or reconcile unknown restore results.

Task row status, assignee, predecessor and delete actions now require the exact selected task from a usable current list. Loading/failed reads, replaced rows, pending row mutations or leaving the page block old handlers; blocked select changes revert their display. Fresh current rows remain actionable. This does not add remote version checks, unknown-result replay protection or general mutation reconciliation.

An unconfirmed snapshot Restore now blocks another restore or capture until an explicit successful current snapshot read. Check the project before refreshing and acting again. Failed reads keep the block; reads begun during the restore cannot clear a later unknown result. Confirmed restore followed by a failed list read remains confirmed. This is page-local recovery, not durable uncertainty, exactly-once restore or automatic replay.

Confirmed task row update/delete now shows a named receipt before refreshing the current filtered list. Failed reads, Retry tasks and filter changes retain that result without replaying the change. A new row action or project visit clears it; an older overlapping row completion cannot overwrite the later action's receipt. This does not add durable receipts, exactly-once changes or unknown-result replay protection.

Unconfirmed task row update/delete now pauses row changes without an automatic filtered read. Check tasks, then use Read all tasks: this clears saved filters and unlocks row actions only after a successful current unfiltered read. Failed, ordinary, filtered or already-pending-write reads cannot clear the pause. New-task drafts and confirmed receipts remain separate. This is page-local replay protection, not durable uncertainty, outcome detection, cancellation or exactly-once changes.

An unconfirmed glossary translation save now pauses saving/deleting that term. Its local text remains read-only and selectable: copy drafts before Refresh, which replaces translation fields with saved values. Failed reads or reads begun during the save do not clear the pause; a successful later current read does. Unrelated terms and the new-term draft remain separate. This is page-local replay protection, not durable recovery, outcome reconciliation or exactly-once saving.

Reports now offers independent Refresh branch reports, Refresh usage and Refresh task report controls. Refresh keeps the selected branch/usage window and sibling figures, prevents duplicate refresh while pending and uses existing section-specific error/retry guidance. Branch filters still affect progress/quality only; usage/tasks cover the project. These are separate current reads, not one database snapshot or automatic polling.

QA checks now offers a branch selector with independent branch-option retry. Checks capture the selected branch and locale, clear stale findings while loading and ignore older responses after a scope change. Project visits reset to main; failed branch discovery leaves main checks available. Scope and empty guidance name the branch. For nonmain findings, open Editor and select that branch manually; no editor focus/deep-link is added.

Projects now offers Refresh projects without leaving the page. It reads only the project list and retains the new-project draft, confirmed receipt and two-factor state. Pending refresh rejects duplicates; failed reads use Retry projects without replaying a create. No automatic polling or draft persistence across navigation is added.

Tasks now distinguishes unavailable assignee, group and lockable-key options from empty choices. Each option source has independent loading/error/retry guidance. Retry retains the new-task draft, selections, current task rows and filters, and does not reread sibling choices or submit a change. Server-side task validation and authorization are unchanged.

Glossary now has local search across loaded term names, notes and translation values, including local text. Matching is a literal, case-insensitive substring with match counts and Clear search. Hiding rows does not discard drafts or clear an unknown-save pause. Moving from an edited translation field still triggers its existing blur save; search does not fetch newer server data or submit an additional change.
