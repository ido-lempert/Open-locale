# Open-locale implementation plan

Open-source replacement for Lokalise: Nx monorepo, Angular, PostgreSQL.
This plan maps the reference product's capabilities from its public product pages,
pricing matrix and API reference, and prioritizes them into four phases.
Checked 28 Oct 2026 against lokalise.com and developers.lokalise.com.

## What the product must cover

Lokalise is a full localization platform, not only a developer API. Its surface
breaks into five areas:

- **Translation management core**: projects with branching, keys, a collaborative
  web editor, translation memory, glossary, QA checks, screenshots for context,
  translation statuses and history, and import/export across 30+ formats.
- **Collaboration**: teams, roles and permissions, user groups, comments, tasks
  with locks and chaining, and audit logs.
- **Automation and delivery**: a full REST API with OAuth 2, CLI, SDKs, webhooks,
  60+ integrations (GitHub, Figma, Slack), over-the-air mobile updates, and
  in-context web and mobile editors.
- **AI and machine translation**: context-aware AI translation, multi-engine
  routing, quality scoring, and custom AI profiles.
- **Enterprise**: SSO/SAML, 2FA, secure password policies, reporting dashboards,
  and vendor rate profiles.

**Coverage gaps.** This map comes from public pages and the API reference, not
from using a paid account. Areas seen only at summary level: Vantage document
internals, AI routing and scoring specifics, vendor rate management, and the
mobile SDKs. Phases 2-3 will be refined against the API spec as they approach.

## Architecture

| Piece | Choice |
| --- | --- |
| Monorepo | Nx 24, npm workspaces |
| Web app | Angular (standalone, zoneless) |
| API | NestJS + Prisma, public REST API |
| Database | PostgreSQL 16 |
| Local run | docker-compose: db, api, web |
| CI verification | Real embedded PostgreSQL in tests |

The Docker configuration is statically verified (scripts/docker-static-test.mjs)
but not yet executed - the development sandbox has no Docker daemon. Until a real
`docker compose up` on a machine with Docker, database-backed checks run against
a real PostgreSQL started by the test harness.
The repository stays unlicensed for now: MIT is the recommendation.

## Phase 0 - foundation

The smallest product that is genuinely usable: sign in, create a project,
add languages, manage keys and translations, export a file.

- Repo scaffold: Nx monorepo with apps/web (Angular), apps/api (NestJS), shared types library.
- Database schema: users, teams, projects, locales, keys, translations. Prisma migrations on PostgreSQL.
- Auth: email + password sign-in with JWT, plus personal API tokens.
- Projects, languages, keys: full CRUD with per-project language lists and plural-aware key metadata.
- Translation editor v1: filterable key list with side-by-side language editing and autosave.
- Import/export v1: JSON (nested and flat) upload and download per language.
- docker-compose: one command runs Postgres, API and web on any machine with Docker.

## Phase 1 - a working TMS

- Statuses and history: unverified/reviewed states per translation with full version history.
- Tags, search, filters: key tags, text search, and filters by status, language and tag.
- Comments: per-key threads with mentions, scoped to a language or all languages.
- Screenshots: upload context screenshots and link them to keys.
- Tasks: create translation or review tasks, assign contributors, set due dates.
- Translation memory: exact and fuzzy match suggestions while typing; TMX export.
- Glossary: project terms with forbidden variants, surfaced in the editor.
- QA checks: placeholder mismatch, length limits, whitespace, number and HTML checks.
- Activity log: every change recorded per project, filterable by actor and target.
- More formats: PO/POT, XLIFF, Android XML, iOS strings/stringsdict, CSV, ARB, RESX.

## Phase 2 - automation and scale

- Review workflow: custom translation statuses and review queues per language.
- Public REST API v1: everything the UI does, with OpenAPI docs and scoped tokens.
- Webhooks: project events pushed to any URL with signed payloads.
- CLI: upload and download translation files from the terminal.
- Branching and snapshots: project branches with merge, plus restorable auto snapshots.
- Granular permissions: per-language contributor access, groups, admin roles.
- GitHub integration: two-way sync between a repo and a project.
  Current bounded slice: target screen previews accepted baseline, stored local
  translations and fresh verified remote bytes, with manual-review rows and
  pagination. Explicit draft selections/download recompute sources and check
  reviewed fingerprint before preparing bytes. No apply or two-way synchronization
  yet. Draft API materializes locale-only set/removal plans without executing
  them. UI reviews materialized set/removal/current/draft values with independent
  pages. Same-snapshot key/row/metadata preconditions prepared for future guarded
  execution, plus internal Serializable locked-row validation. No apply path
  yet. Isolated existing-key locale-set writer with history/activity rollback
  tests; durable locale-removal audit added, production integration still open.
  Internal current-admin/target/baseline locked transaction guard added; no public
  execution. Isolated exact-draft transaction composition added, missing production
  effects/fresh-source execution integration remain. Transactional TM helper shared
  with normal save/import and isolated writer. Durable transaction-coupled effect
  intents added; internal bounded lease/retry bookkeeping added. Dispatcher and
  dispatch remains code work. Bounded internal seven-day terminal cleanup added,
  not scheduled. Internal current-scope/generation eligibility
  guard added, not dispatch permission. Pending admission capped at10k/8MiB before writes. Internal one-step runner composed, no production handler/worker. Internal webhook adapter added with real signed receiver checks, no enabled worker
  or automation handler. Explicit internal webhook-channel step verified end-to-end; no combined worker
  or automation completion. Repository current-context rechecked per actual webhook attempt including retry.
  Webhook subscriptions rechecked per socket; stale captured routing aborted.
  Independent webhook completion checkpoint added; no automation completion.
  Webhook API-update revision fences captured routing ABA on retry.
  Automation outcome summaries added before repository-channel integration.
  Internal repository automation adapter added, no per-rule retry deduplication
  or enabled combined worker. Per-rule current-intent guard stops remaining rules
  after context change/lease expiry. Captured rule freshness/revision guard rejects
  disabled/deleted/edited/restore-ABA rules. Automation notify carries current-intent/
  rule guard per socket/retry and before each pretranslate target locale.
  MT revalidates after provider computation before write transaction.
  Internal automation-only step/checkpoint added; no combined worker or per-rule
  partial retry ledger. Explicit internal combined step added under one lease,
  independent channel checkpoints; worker defaultOFF. Intent-scoped successful-rule checkpoints skip completed rules on partial retries;
  crash gap remains. Rule checkpoint writers lock intent before evaluating deadline/token under
  contention. Both channel checkpoints also lock before deadline/token evaluation under
  contention. First automation dispatch freezes eligible rule IDs; new rules excluded on
  retry, configuration remains current. Rule manifest cap1000/UUID uniqueness enforced; empty selection stays empty.
  Opt-in Nest worker (defaultOFF),one intent/5sec,no local overlap,shutdown drain.
  Internal fresh-source service recomputes authorized resolution and binds exact reviewed
  fingerprint/digest before Serializable local write/history/TM/intents. Existing-key
  sets/removals only; no baseline advance/remote write/accepted sync.
  Explicit session-admin apply-local API now binds revision/fingerprint/choices/digest,
  commits local-only set/removal/history/TM/intents atomically. Web UI adds separate
  reviewed local apply confirmation, cancel, counts/digest and stale-review clearing;
  no baseline advance, remote write or accepted sync. Typed local apply denials400/409;unexpected storage faults remain500/rollback.
  Actual PG raw-lock SQLSTATE40001 conflict mapped409 without retry.
  Local apply per-lock2sec timeout55P03 maps busy409;actual project/translation
  contention tested without partial writes. Separate defaultOFF terminal retention flag,100old terminal rows/min/process,
  shared non-overlap/drain;retention-only does not dispatch. Terminal-only ordered partial retention index with preserved migration data.
  Session-admin target-scoped effect summary API adds aggregate queue visibility,
  not delivery/sync acceptance;no retry mutation. Manual read-only web summary adds
  explicit snapshot/retention/worker-unknown notices and stale-response fencing.
  Eligibility guard per-lock2sec timeout;actual project/translation blockers
  requeue without invoking handler and recover after release. Rule/channel checkpoints also use per-lock2sec timeout with actual intent-lock
  denial/recovery tests;effect-before-checkpoint crash gap remains. Settlement locks intent before clock/token with per-lock2sec timeout;actual
  stale-token/expiry/timeout contention rejects success. Due retention still attempts after effect-step failure,with independent flags
  and original per-process cadence/drain. Manual summary adds aggregate independent/both channel checkpoint counts,
  explicitly not receiver receipts. Shutdown during in-flight effect prevents newly due retention afterward;
  actual held-socket/terminal-row lifecycle verified. Removal effects now bind durable audit-UUID generation,blocking recreate/remove
  absence ABA;legacy unbound removals fail closed. Session-admin latest50 deletion audit metadata API excludes snapshots/values,
  read-only and project-scoped;no restoration. Manual project-wide metadata web pages now support older-page
  navigation,empty/error states and route freshness. Stable timestamp/ID keyset
  pagination exposes older metadata without requiring boundary rows to survive. Ordered project/timestamp/UUID index supports metadata pages;real Prisma SQL
  plans and migration preservation verified. Audit page loading status and focus/viewport landing support keyboard navigation. Internal read-only deletion recovery diagnostic validates bounded flat snapshots,
  current absence/key/locale and exact removal generation;no restore execution/API. Internal Serializable recovery guard locks current admin/scope/generation with
  per-lock2sec timeout,binds digest;no restore execution/API. Isolated internal recovery writer adds fresh row/new history/activity/TM with
  rollback proof;no public restore API/UI or repository effect composition. Actual PostgreSQL competing recovery/normal-create races preserve winning row
  and deny stale success without duplicate history/activity. Internal recovery binds reviewed branch UUID and locks branch scope,denying
  key movement/deleted branch despite matching digest. Session-admin read-only recovery eligibility preview returns reason only without
  archived bytes/digest or authority;consistent snapshot,no reservation/restore mutation. Manual per-audit eligibility UI shows fixed current-only reasons,no reservation
  or restore action,with stale-response/error/page clearing. Eligibility uses explicit DB transaction snapshot timestamp in API/UI,not
  an aging just-now claim. Internal recovery review also binds key metadata timestamp,denying restored
  metadata changes when their stored timestamp differs,or stale review. Timestamp alone is not a monotonic generation;database-owned key revision now also binds review,including same-timestamp raw SQL edits/restore. Guard/writer capture primitive scope before awaits,preventing caller mutation during lock waits. Eligibility rechecks effective direct/group admin within its diagnostic snapshot,denying revocation after preflight but before snapshot. Deletion-audit metadata pages also bind effective admin authorization to their own RepeatableRead page snapshot. Internal recovery also honors effective group-admin grants with locked grant/role rows and team membership outer boundary. Direct admin avoids group locks;group-derived auth locks only ADMIN grants,not unrelated MEMBER rows. Recovery diagnostic bounds archived JSON in PostgreSQL projection before API transfer. Separate explicit session-admin read-only bounded archived value review API adds no execution token/restore action;eligibility remains value-free. Manual archived value review UI escapes text,shows dated read-only limits,and clears private text on hide/refresh/error/navigation. Pending archived-value UI announces loading and supports cancel with stale-response fencing,not network-abort claims. Archived-value keyboard focus lands result/returns after hide/cancel,with generation fencing. Eligibility/value-review/audit page snapshots enforce PostgreSQL READ ONLY with actual write-denial tests. See reviews0134-0215.

## Phase 3 - advanced

- OTA delivery: over-the-air translation updates with a versioned CDN endpoint and mobile SDK.
- In-context editor: edit translations live on your own website.
- AI and MT hooks: pluggable machine-translation providers and AI pre-translation with scoring.
- Reporting: quality, usage and task dashboards per project.
- SSO/SAML and 2FA: enterprise sign-in and second factors.
- Automations: trigger-based rules - on key change, pre-translate, create task, notify.

## How every development lands

1. Developer pass: correctness, simplicity, error handling, no dead code.
2. Product-manager pass: does it match the capability map and the user's flow.
3. Designer pass: layout, hierarchy, empty and loading states, mobile widths.
4. Security-researcher pass: injection, auth bypass, data exposure, dependency risk.
5. QA/integration pass: real database run, API and UI wired end to end.
6. All findings fixed and the passes re-run clean; only then a commit.

## Sources

- https://developers.lokalise.com/reference/lokalise-rest-api - endpoint families including branches, OTA and OAuth 2.
- https://lokalise.com/product - platform positioning and feature areas.
- https://lokalise.com/pricing - the full feature matrix used for the capability map.
- https://lokalise.com/integrations - the 60+ app directory.
- https://github.com/ido-lempert/Open-locale - where all code lands.

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

Target recovery review now captures its original authenticated actor before any
await and retains it across preflight/snapshot caller-principal mutations. Real
PostgreSQL cases and old-code negative control cover both boundaries. No new
restore route/action or remote write. See review0224.

Shared repository write-scope guard now captures its own scalar bindings before
database awaits. Real PostgreSQL query-boundary mutation cases and old-code
negative control cover actor consistency independently of caller copies. No new
API or remote write. See review0225.

Shared local precondition validator now owns nested key/translation generations
before database awaits. Real PostgreSQL stale-to-current and valid-to-invalid
caller mutations retain original entry semantics. No new execution/API. See
review0226.

Shared local writer now owns nested reviewed snapshot and change inputs before
any await. Actual PostgreSQL guard/upsert-boundary mutation tests preserve exact
locale/value/history/activity and prove rollback invariants. No new API. See
review0227.

Internal recovery execution now maps typed domain limits/conflicts and exact
Prisma serialization/lock-timeout errors to explicit400/409 without retry. Actual
PostgreSQL55P03/40001 cases prove one attempt and unchanged recovery effects;
unknown faults remain faults. At review0228 no public restore route existed.

Explicit session direct-admin recover-local POST now validates exact confirmation
and flat reviewed bindings,then uses one captured-scope Serializable execution.
Real HTTP auth/validation/stale/commit/replay/forged-body tests cover local-only
value/history/intent outcomes. No restore UI action,remote read/write,baseline
advance or worker enablement. Current138routes. See review0229;older notes are
historical implementation milestones.

Explicit recovery API now has actual HTTP project-lock busy,real database intent
fault rollback/private-error and competing-request one-winner evidence. Tests
only,no app behavior change. See review0230.

Recovery composition now enforces32768UTF8bytes before writes,matching public
review. Actual HTTP multibyte exact-bound success and forged over-bound rejection
cover the consistency fix. See review0231.

Actual committed post-review target/baseline/key/generation/value changes now have
public recovery HTTP409 and exact unchanged-state evidence. Tests only,no app
behavior change. See review0232,including non-discriminating negative limitation.

Recovery public HTTP current-role revocation and missing/cross-project route scope
now have unchanged-effect/privacy tests. Tests only,no app change. See review0233.

Public recovery now has actual project-lock wait plus committed admin revocation
HTTP409/no-partial-effect evidence,not only revocation completed before request.
Tests only,no app change. See review0234.

Target-scoped review now supports separate prepare/cancel/confirm local recovery,
with exact reviewed scalar bindings,private-state clearing,unknown-outcome warning,
no retry and focused outcome. Actual browser cancel/stale/failure/commit cases and
480px screenshots verified. Value-only review stays read-only. See review0235.

Committed recovery with unavailable browser response now has real local upstream201
and exact persisted value/history/intent proof,uncertainty/no-retry/fresh-review
checks. Eligibility-only wording points to the separate confirmation flow instead
of claiming all recovery unavailable. See review0236. No remote-delivery promotion.

Pending recovery now has focused non-cancellation guidance and route/destroy cleanup.
Actual committed201 response held across reused-component project navigation proves
old outcome/private review/focus do not cross scope;original value/history/intent
still persist once. See review0237. No durable outcome notification or remote sync.

Configuration refresh now clears private archived value/prepared recovery bindings
before awaiting config response,on unchanged config and on failure. New explicit
review required;busy refresh does not interfere with pending recovery. Actual held
GET and failure browser cases verified. See review0238.

Configuration save/remove now share refresh's immediate private archived-review
cleanup before network awaits,including failures. Successful removal cannot leave
prepared bindings for a missing target. Unit success/failure/guards and browser
failed save/remove plus actual removal verified. See review0239.

Actual successful-save browser boundary now verified:held PUT clears prepared
recovery,committed path/revision invalidates baseline with no local recovery writes,
fresh no-baseline review denied/no prepare. Test-only fixture reset isolates later
recovery cases,not UI baseline acceptance. See review0240.

Denied archived-review guidance now uses fixed safe reason descriptions and next
steps instead of one generic message. Actual no-baseline and already-recovered
browser cases verify guidance with no value/prepare controls. Unknown reasons stay
generic. See review0241.

Recovery prepare/cancel keyboard landing now explicitly verified:confirmation
region focus then Prepare return,with rapid cancel/scope/replaced-audit callback
fences. No automatic mutation. See review0242.

Explicit visible focus outlines verified for recovery confirmation/outcome;actual
keyboard-only Tab/Enter cancel/prepare path tested with unchanged value/queue on
cancel. Addresses review0242 visual finding. See review0243.

Private recovery cleanup extends to accepted baseline/local apply before await.
Unit success/failure/guards and actual held-baseline acceptance prove no retained
prepared review. Comparison baseline version+1 is not accepted sync. See review0244.

Actual held local-apply/private-recovery browser boundary now verified:private
review clears before response,exact intended value/history/intent commits,archived
deleted value stays absent. Tests only,no app change. See review0245.

Denied archived review now projects null value before state storage,defending
against inconsistent denied responses carrying private bytes. Both review modes
and browser rendering/control denial tested. No server change. See review0246.

Client value review now enforces literal availability,string type and32768UTF8byte
bound before retaining private value/bindings. Exact multibyte/empty and malformed/
oversize tests verified,server unchanged. See review0247.

Recovery preparation now requires complete typed bindings matching selected target
ID/revision/branch/locale. Malformed bindings leave a valid archived value read-only,
without Prepare/Confirm. Server authority/freshness checks unchanged. See review0249.

Read-only selected-target review with missing/malformed execution bindings now
explains why Prepare is absent and points to explicit configuration refresh/fresh
review. No automatic requests. See review0250.

Report branch switching now clears old progress/quality and ignores superseded
success/error. Both requests capture the same branch and publish a complete pair;
not one database snapshot. Actual held-response browser switch verified. See0252.

Reports now subscribe to reused project-route changes,clear all previous project
figures and fence late branch-list/usage/tasks responses. Separate branch-request
fence retained. Actual same-component navigation/held old usage verified. See0253.

Report usage/tasks now show explicit loading and fixed section failure guidance
instead of silent blank sections. Successful sibling retained after both settle;
old project errors fenced. Actual usage503/browser proof. See0254.

Progress/quality report failures now use fixed guidance,not raw serverdetails.
Explicit branchloading/status/mainaria-busy respect stale-response fencing;
quality503browser proves no partialfigures and successfulusage/tasksretained. See0255.

Task report workload groups by stable nullableassigneeID,not displayname. Same-name
people and person named unassigned remain distinct from nullbucket. UI shows full
identitycue. Group-nullworkload semantics unchanged. See0256.

Task reports now separate group workload by kind+stablegroupID rather than placing
groupassignedtasks in unassigned. User/group/nullbucket counts oncepertask;UIgroup
cue explicit. Same-namecollision/reconcileHTTP/browserverified. See0257.

Usage days query requires decimal safeinteger when supplied;malformed/nonfinite/
fractional/unsafe400. Missing30,validintegersclamp1..90,explicit0now1. NoUIchange.
RealHTTP41/unitboundarytests verified. See0258.

Usage topactors now retain stableactorID with deterministic tieorder/UIidentitycue;
same-nameactors remain separate and distinguishable. Top5/nullactorsemantics
unchanged. RealHTTPsame-nameevents/browserverified. See0259.

Usage aggregates share capturedsince/asOfinclusivewindow,exclude futureevents,
and return explicitUTCdaylabels regardless DBtimezone. AdditiveasOf/timezoneUTC;
separatequeriesNOToneDBsnapshot. ActualnonUTCDB/futurefixtureverified. See0260.

Usage activeKeys now uses PostgreSQL COUNT(DISTINCT keyName), returning one scalar
instead of materializing every name in the API. Same activity-name/null/empty/
project/window semantics. Actual1500-name fixture plus duplicate/null/empty/old/
future/other-project controls verified. No DB resource-bound claim. See0261.

Task workload now groups effective user/group/null assignments in PostgreSQL
before joining names, rather than materializing every open task in the API.
Preserves one count per task and same-name identity separation. Real1501-extra-
user/DONE/other-project fixtures reconcile. No DB resource-bound claim. See0262.

Usage top-five boundary now has actual PostgreSQL HTTP evidence with seven tied
same-name actors, exact stable-ID cutoff/repeated read, null-actor events retained
in totals but not ranking, and future-only actor excluded. Test-only. See0263.

Progress edge contracts now have actualPGHTTP evidence: filled translations with
removed custom status still count/reconcile; empty values with that status do not
inflate filled/status totals; empty branches yield finite zero percentages in all
locales. Test-only. See0264.

All four report routes validate projectId as UUID before service/Prisma work.
ActualHTTP malformed400/validunknown404/anonymousmalformed401 verified perroute.
Project authorization remains separate. See0265.

Successful report responses now explicitly use Cache-Control:no-store, verified
on all four routes with member session and read token. No earlier-cache erasure,
client-memory erasure or blanket error-response claim. See0266.

Task status/overdue/due-soon counts now share one PostgreSQL aggregate statement
and captured clock. Assignment workload remains separate, not one report snapshot.
Actual6-task date/status fixture and unit clock/query checks verified. See0267.

All four reports now have actualHTTP membership/token revocation evidence:
same member session/read token denied after committed team removal, restored by
explicit re-add; revoked token401 while session remains200. Test-only, not in-flight
revocation atomicity or client-cache erasure. See0268.

Progress/quality branch queries now require one valid branch name when supplied.
Empty/repeated/malformed400;omittedmain/validunknown404. Literal bracket query key
is ignored by simple query parser, not interpreted as branch object. See0269.

Progress key denominator and filled status groups now share one SQLstatement
snapshot via scoped-key CTE/zero-preserving totals join. Project/locales/branch
resolution remain separate, not whole-report snapshot. ExistingPGHTTP111 plus
empty/retired-status singlequery units verified. See0270.

Group workload fixture now has two actual members rather than an empty group.
NormalAPI rename preserves stableID/count; deletion moves exactly one task to
unassigned with totals unchanged. Sequential committed-change proof. See0271.

Usage UI now shows exact captured since/asOf window, UTCcalendar note and separate-
reads snapshot caveat; actor ranking labeled Top5. Actualbrowser response-to-text
checks and fresh480fullpage inspected. Normalverticalscroll, no querychange. See0272.

Usage actor table now explains an empty attributed ranking without hiding null-
actor activity totals. Actualnull-onlyevent/browserfixture and fresh480fullpage
verified. No API/querychange. See0273.

Usage action table now explicitly states no activity for an empty window,
distinct from no attributed actors. Actualzero-event/null-actortransition browser
checks and fresh480fullpage verified. No API/querychange. See0274.

Task report explicitly states No open tasks when workload empty, including DONE-
only projects while retaining completed-task summary. Actualbrowser zero/DONE-only
fixtures and fresh480fullpage verified. No API/querychange. See0275.

Quality finding cardinality now has actualPGHTTP proof:4findings across2target
locales on1key;type/locale sums reconcile and directQA endpoint count/keyidentity
matches. Test-only, no applicationchange. See0276.

Quality report now explicitly explains zero findings from current checks on the
named branch, retaining numeric zero summary. Realbrowser zero->untranslated-
finding->cleanup transition and fresh480fullpage verified. No APIquerychange or
blanket translation-correctness claim. See0277.

Task report now returns exact asOf/dueSoonThrough deadline bounds from the query's
captured clock. UI shows inclusive due-soon window and separate-workload-read
snapshot caveat. Unit parameter identity, actualHTTP ISO bounds and browser
response-to-text verified. No new query or whole-report snapshot claim. See0278.

Task report failure/recovery now has actualbrowser task-only503 evidence: fixed
guidance/no stale taskfigures/window, successful siblings retained, explicitreload
recovers zero summary/workload without stale error. Test-only, not memory erasure
or externalservice outage proof. See0279.

Report scope now explicitly states usage/tasks cover wholeproject; branchselector
filters progress/quality only. Actual heldbranchbrowser verifies projectdashboard
text/cutoffs stay unchanged while branchpair loads. No APIquerychange. See0280.

Report loading now starts main reports/projectdashboards independently of branch
list, retaining late-project/destroy fences. Main selector fallback visible while
list unavailable. Unit and actual held-listbrowser verify figures finish without
waiting for branch discovery. No APIquerychange. See0281.

Branch discovery failure now shows fixedguidance instead of silently suggesting
main is the onlybranch. Mainreports/projectdashboards retained, explicitreload
recovers branchoptions. Current/lateproject/destroyfences unit-tested and actual
browser503/recovery verified. NoAPIquerychange. See0282.

Branch discovery now has separatereadable loadingstatus and selectoraria-busy,
without blockingreports. Oldprojectcompletion cannot clear newerloading. Unit+
actualheldlistbrowser verifies loading/settledstates. NoAPIquerychange. See0283.

Usage/tasks now publish independently with separatesectionloading while mainbusy
covers eitherpending. Project/destroy fences retained perresult/error/finally.
Heldsiblingunits and actualheldusagebrowser verify completedtasksvisible before
usagefinishes. NoAPIquerychange/synchronizedsnapshotclaim. See0284.

Usage window picker offers7/30/90days with default30/projectreset. Refreshesusage
only; sameprojectrequestgeneration fences lateoldwindow success/error/loading.
Unitfences and actualbrowser7dayresponse/taskcutoffunchanged verified. NoAPIquery
change or synchronizedsnapshotclaim. See0285.

Usagewindow sameprojectfence now has actualbrowser hold90->finish30->releaselate90
proof: pendingselectionclearsfigures, latestselection/bounds/loading/taskcutoff
retained. Test-only, noapplicationchange. See0286.

Failedusage now offers inlineRetryusage for selectedwindow without refreshingtasks.
Actualbrowser failed7day/read-onlyretryclick verifies7dayresponsebounds/recovery/
unchangedtaskcutoff. Existingrequestfences reused. NoAPIquerychange. See0287.

Failedtasks now offers inlineRetrytasks without refreshingusage. Taskloader has
sameprojectrequestgeneration+project/destroyfences. Unitstalesuccess/error/loading
and actualbrowserretryclick/unchangedusagewindow verified. NoAPIquerychange. See0288.

## Continuation223 - inline branch-report retry
Added error-only Retry branch reports using existing fenced selected-branch pair
fetch. Actual quality503/retry click recovers progress+quality, preserves selected
branch and exact usage/task cutoff text. Selected-feature unit, web158/9,
browser238; five-perspective review0289. No API/query/schema/provider changes;
coverage22FULL/7PARTIAL/1MISSING/defaultOFF and snapshot caveats unchanged.

## Continuation224 - inline branch-list retry
Branch discovery now retries independently with request-generation/project/destroy
fences, preserving selected branch and successful reports/dashboards. Actual503
and realbuttonretry recover options with unchanged main/progress/usage/task
cutoffs. Web161/9, browser239; five-perspective review0290. NoAPI/query/schema
change; coverage22FULL/7PARTIAL/1MISSING/defaultOFF and snapshot caveats unchanged.

## Continuation225 - QA page scope and retry
QA findings now clear during loading/failure, with fixed error and selected-locale
retry. Reused route/request/project/destroy fences prevent late findings/metadata
from crossing scope. Six units plus dedicated actualPG/Chrome QA6 browser checks;
web167/10. Pending/error are not zero-success. Five-perspective review0291.
NoAPI/query/schema/provider changes or coverage/defaultOFF promotion.

## Continuation226 - QA plural row identity
Plural findings no longer share duplicate key/locale/type tracking identity. Real
plural API/browser proves one/other details both render with no duplicate-track
diagnostics. Finding table now spaced and horizontally scrollable at480 rather
than breaking key/badge words. QA browser9; review0292. NoAPI/query/schema or
coverage/defaultOFF change; structural checks are not translation certification.

## Continuation227 - Activity scope, pagination and retry
Activity now fences project/filter/page responses and member metadata; typing
invalidates old reads before debounce. Concurrent Load more suppressed; failedpage
keeps prior rows/cursor and explicitretry appends once. ActualPG/Chrome activity6
and six units (web173/11), review0293. NoAPI/query/schema or coverage/defaultOFF
change; pending/failure are not empty-success, no delivery/exactly-once claim.

## Continuation228 - Activity same-project browser race
Actual heldolderpage now proves concurrent Load more stays oneHTTPrequest, then
sameproject keyfilter completes11matchingrows and lateolderresponse cannotappend
or change latestfeed/loading/cursor. Test-only; activitybrowser8, review0294.
No application/API/schema or coverage/defaultOFF changes.

## Continuation229 - QA locale options retry
QA locale discovery now independent with loading/fixedfailure/retry and own request/
project/destroyfences. Actual metadata503/retry restoresoptions while findings and
oneQAread remain unchanged. Three units/web176/11, QAbrowser11; review0295.
NoAPI/query/schema or coverage/defaultOFF change.

## Continuation230 - QA held locale discovery
Actual heldmetadata retry proves independent status/selectorbusy with completed
findings/count retained and no extraQAread; release settlesoptions/status without
replacingtable. Test-only, QAbrowser12; review0296. Noapplication/API/schema or
coverage/defaultOFF changes.

## Continuation231 - Explicit QA refresh
Run checks again reuses fenced readonlyloader with disabledpending control. Actual
translationrepair/refreshclick reduces5to3findings, preservesselectedHebrew/no
metadatareload. QAbrowser14, review0297. NoAPI/query/schema or coverage/defaultOFF
changes; explicitrefresh, notlivepolling or translationcertification.

## Continuation232 - Activity action vocabulary
Activity dropdown now offers11previouslymissing declaredserveractions for task/
glossary/screenshot/MT/automation/embedorigins. Exactdeclaredset unit and actual
taskcreate/filter proof; web177/11, activitybrowser9, review0298. NoAPI/query/
schema or coverage/defaultOFF change; no neweventdetail/retention guarantee.

## Continuation233 - Activity task and glossary details
Existing bounded tasktitle/term snapshots now shown for fivecreated/updated/deleted
eventkinds. String-only extraction and real literalmarkup rendering tested; web182/
11, activitybrowser11, review0299. NoAPI/query/schema/newfield or coverage/defaultOFF
change; eventnames are snapshots, not live/currentstate links.

## Continuation234 - Activity actor options retry
Actor discovery now has independent loading/fixedfailure/retry with own request/
project/destroy fences. Real metadata503 and heldretry prove feed bytes/count/
requestcount unchanged while actor options recover. Five units/web187/11 and
activitybrowser14; review0300. NoAPI/query/schema or coverage/defaultOFF change.

## Continuation235 - Explicit Activity refresh
Refresh activity reuses fenced readonly firstpage loader, preserving selected
filters and leaving actor metadata alone. Pending control suppresses duplicate
reads. Actual newtask/refresh shows newevent without metadatareload; two units/
web189/11/activitybrowser16, review0301. NoAPI/query/schema or coverage/defaultOFF
change; explicitrefresh, notlivepolling or completehistory guarantee.

## Continuation236 - Activity actor metadata route race
Actual held oldteam member response released after reusedroute settles newteam
options/feed cannot replace either or alter their loading/error state. Separate
team fixture ensures distinct membership; Activitybrowser18, review0302. Test-only;
noapplication/API/schema/coverage/defaultOFF change.

## Continuation237 - Incomplete Activity role snapshots
Member/group update detail guards now reject missing/malformed nested role/locale
snapshots rather than throwing during feed rendering. Valid summaries unchanged;
three units/web192/11 and actual persisted malformed+valid rows/activitybrowser20,
review0303. NoAPI/query/schema/coverage/defaultOFF change; other detail formats
not covered by this bounded hardening.

## Continuation238 - Task Activity change shapes
Task update detail now validates map/pairs and existing string/null/boolean/string-
array values rather than coercing malformed snapshots into bogus summaries. Valid
neighbor changes survive; three units/web195/11/activitybrowser21, review0304.
NoAPI/query/schema/coverage/defaultOFF change; not all audit detailformats hardened.

## Continuation239 - Linked-task creation audit
Task createIn now records existing creation event before keyed-task early return,
inside the same transaction. Actual linkedtask records exactlyoneevent; injected
DBlinkfailure leaves neither task nor event. Tasks75->77/activity22, review0305.
NoAPI/query/schema/coverage/defaultOFF change; fixes future events, no historybackfill.

## Continuation240 - Creation audit failure rollback
RealDBauditINSERTfailure proves neither ordinary nor keyedtask survives without
its audit; removedtrigger restoresexactlyonetask/link/event. Tasks77->80, review0306.
Test-only; noapplication/API/schema/coverage/defaultOFF change.
