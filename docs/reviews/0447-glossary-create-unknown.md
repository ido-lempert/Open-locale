# 0447 Unconfirmed glossary term creation pause

## Developer review
Visit-local createUnknown refuses DOM and captured-handler submissions until a
successful current glossary read. Create epoch changes at request start and
uncertain outcome, with pending-at-start/current fences: reads begun before or
during creation cannot unlock its later uncertainty. Project/reset/destruction
fences retained. No API/schema/dependency change. Failed read stays paused.

## Product review
A lost response can hide a committed glossary term. Read and inspect before
adding again; no automatic create retry or automatic glossary reload. Term,
notes and do-not-translate remain editable and kept through recovery. Copy local
translation drafts before refresh because it replaces server-backed fields.
Independent row save/delete stays available. Visit-local only, no persistence,
request identity, exactly-once guarantee, cancellation or proof of causation.

## Design review
Actual desktop and390px screenshots inspected: readable wrapped warning, retained
form, disabled Add term and independent refresh/translation controls fit. Only
matching generic create error suppressed; independent row error remains visible,
proven through browser. Input's ordinary horizontal text clipping remains normal.

## Security review
No raw exception or automatic mutation replay, no external/worker/account changes.
Read failure never grants create permission. Unit fences and browser captured
handler check cover bypassing disabled button. Owner upload request recovered
verbatim before upload, exact repo/branch and remote state checked separately.

## QA/integration review
New unit7/web838 in77 suites/API265 in31/builds0. New real browser9/0 forwards
actual creation to local API/Postgres then aborts browser response after commit:
checks whole form, no replay, independent save/error, failed read pause, current
read discovers term, explicit next different term once. Existing glossary browser
initial11/1 timeout on obsolete generic-error/enabled-submit expectation, fixture
aligned to new pause UX then38/0, no app change. api-tokens typo invoked no suite,
correct apitokens34/0. Tasks-action-unknown twice and tasks-create-receipt once
aborted before assertions on PG bind; unchanged repeats10/0 and5/0. All API and
74 isolated browser suites final0. Native first initially115/1: untouched YAML
format select already yaml but notice absent at sample; unchanged first116/0,
middle111/0, tail19/0, inner/outer0,246total242unique/four startup repeats. Sync
separate95+144=239unique, inner/outer0. No canonical uninterrupted claim. Continued
runs preserve completed checks. Config16/14/docs4-138routes/reaper4 all0. No
credential/port/process/app change to address transient startup/notice failures.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
