# 0318 - Glossary create pending guard

## Developer review
Creating signal guards repeated submit and keeps pending through success refetch.
New visit resets visible pending; existing visit fence now also guards finally.
Four units cover duplicate/current success/read lifetime, retained failure draft,
late success and destroy. Existing project destination capture remains. No API/schema.

## Product review
Adding term failure retains term/notes/do-not-translate and asks to inspect glossary
before retry. No auto-retry, cancellation or server idempotency claim. Actual held
old-project POST may persist once after navigation but cannot clear new draft or
start new-project read. Update/delete pending/raw current errors remain separate.

## Designer review
Form busy, disabled Add term and Adding term status explain pending. Actual held
POST tests those controls. Inspected fresh480x900 failure pixels: fixed guidance,
retained term, enabled submit and existing rows readable/fitting. No redesign.

## Security review
Arbitrary create exception replaced by fixed guidance; actual injected private-
glossary-create absent from page. Existing destination/visit/destroy fence respected,
including pending cleanup. Isolated local API/PG/Chrome only; no provider/account/
scope/spend/license/audience change. Owner upload original recovered before publishing.

## QA/integration review
API265/31/web233->237/13 uncached0/builds0. Glossarybrowser8->11 actual held duplicate/
old-project completion and rejected503 checks; no resend during200ms observation,
no fixture term persisted on rejected request.47unique integration/config legs
including docs inner/outer0; Tasks80/Tasksbrowser23/Activity22/QA14/reports118/sync644/
syncbrowser239 unchanged. Reaper4/0/docs4/138routes0. Native STAGED116+128=244total/
242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/test edits
after native; no failures/timeouts/interruption252. Bundle578.90->579.29kBvs500warning.
Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no remote sync/baselineadvance/accepted sync/worker enablement. Existing report
snapshot/window caveats unchanged.
