# 0312 - Task create failure in the actual browser

## Developer review
Test-only extension to existing real Chrome/API/Postgres Tasks fixture. Intercepts
only current project's POST with503 and private marker, then asserts retained title,
fixed error, cleared busy/status and enabled submit. No application/API/schema edits.

## Product review
Failure guidance deliberately asks to inspect the list before trying again. A failed
response can be ambiguous in production. Test observes one POST/no resend for200ms
and unchanged real persisted list; it does not prove cancellation, idempotency, an
unbounded no-retry property or server-side failure atomicity. Assertion wording was
narrowed before final runs to match that evidence. No automatic user retry added.

## Designer review
Inspected fresh480x900 failure screenshot: fixed guidance readable above form,
unsaved title remains, Create task enabled and current task below. Controls fit.
Existing layout unchanged; screenshot is actual browser fixture, not a mockup.

## Security review
Raw injected private-create-detail absent from page. Interception is confined to
isolated local fixture/current task POST. No external provider/worker, registration,
permission expansion, spending, license or audience change. Original authenticated
owner upload request recovered before publication; live main and push access checked.

## QA/integration review
API265/31 and web208/12 uncached0; both builds0. Tasksbrowser13->15 final0. Tasks80,
Activity22/QA14/reports118/sync644/syncbrowser239 unchanged. Final46unique integration/
config legs including docs have inner/outer0; reaper4/0, docs4/138routes0. Native
STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.
No application/test edits after native. Bundle575.89kB vs500warning unchanged.
Docker static-only; no daemon verification. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged; no accepted sync/baseline advance/remote write/worker enablement. Existing
report snapshot/window caveats unchanged.

### Interrupted-run chronology
- Combined tags-through-mt/reports/sync exceeded outer120s. First14 legs each inner0,
  reports118 inner0; sync interrupted. Its first retry had stale PG55482 socket from
  dead owner4678 and0checks/inner0, correctly rejected by batchouter1. Closed TCP and
  zombie owner confirmed, stale socket removed; clean isolated sync644 inner/outer0.
- Combined automation/2fa exceeded120s after automation132 inner0;2fa interrupted.
  Dead PG6306/closed55474 confirmed and stale socket removed. Subsequent combined
  2fa/oidcbrowser exceeded120s after2fa37 inner0; oidcbrowser interrupted. Dead PG6565/
  closed55477 confirmed, stale socket removed; interrupted web6635/Chrome6695 groups
  and their crashpad processes stopped. No other process groups targeted.
- Final isolated automation132,2fa37,oidcbrowser49,samlbrowser61 all inner/outer0.
  Tags-through-config and webhooks/mt/reports rerun to establish clean outer0 for all
  completed inner legs from interrupted combined calls. No app/assertion FAIL run;
  one deliberate batch failure for zero-check invalid startup, plus three timeouts.
