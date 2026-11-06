# 0422 Explicit project list refresh

## Developer review
Added refreshProjects as a guarded entry to the existing list read. Pending,
shared busy and destroyed states reject duplicate or stale handlers. Existing
read generation/destruction fences remain. No second read implementation.

## Product review
A project added elsewhere can now appear without navigating away or losing the
new-project draft. Refresh is list-only; receipt and two-factor state stay intact.
Failed refresh uses existing Retry projects with fixed error guidance. No polling,
remote outcome detection, durable draft or snapshot-consistency claim.

## Design review
Inspected projects-refresh desktop pixels: normal Refresh projects below the
cards, retained new-project fields and separate two-factor panel are readable
without overlap. Pending disables refresh; failure shows Retry instead. No redesign.

## Security review
Existing authenticated GET only. Browser proves no writes or two-factor reads.
No privilege/schema/worker/account/credential/provider/license/spend changes.
Fixed read failure copy does not expose server details. Original owner upload
scope and live target checked before push.

## QA/integration review
Unit3: retained draft/receipt/security state, pending duplicate, busy and destroy
handler guards. API265/31 web709/54 builds0 initial442.76kB. New browser5/0:
real external create appears after refresh, held GET duplicate guard, retained
form/security text, zero mutations/two-factor GETs, failure and GET-only retry.
Existing projects-reads7/projects-create4 all0. All API and isolated browser
regressions0; sync staged95+144239unique0. Native separate stages116/111/19,
246total242unique/four repeats, all inner/outer0. Final configs16/14 docs4-138routes
and reaper4 all0. No failed or interrupted 356 check; staged evidence only, no
canonical uninterrupted claim. Checkpoints removed.22FULL7PARTIAL1MISSING/
defaultOFF and external acceptance unchanged.
