# 0465 Back up local new-project form

## Developer review
Exact raw name/slug/locale text and uncertainty are captured in a versioned JSON
whitelist. No API call, storage or navigation. Pending creation/departure guards
apply to captured handlers as well as the button. Object URL revoked on success
and bounded failure. Feedback snapshot includes uncertainty, clears on creation
start and hides on form edits; independent security fields do not invalidate it.
Copied browser harness header corrected to name this actual form, no behavior fix.

## Product review
Backup remains local/reference-only, not importable or creation/retry authority.
Unknown creation stays explicitly unconfirmed. Failed/pending independent reads
and security work cannot prevent keeping local text. Confirmed unchanged form
produces empty backup rather than exporting submitted server data. Download notice
does not claim device save or sharing, scope warns about private project text.

## Design review
Desktop and390px original screenshots inspected: form, backup button, scope and
status readable; mobile form stacks correctly without document overflow. Separate
two-factor panel remains distinct with empty security input in shared screenshots.
No layout correction required.

## Security review
Explicit fields omit loaded projects/password/code/setup secret/recovery codes.
JSON uses plain serialization, not HTML. No new request, automatic read/write,
shared destination, provider, dependency, license, spend, registration, worker or
credential-scope change. Download is user-initiated and warns about private text.

## QA/integration review
Unit7/web979 in95 suites/API265 in31/builds0 (unchanged API cached). New browser12/0
checks actual downloaded JSON/raw values/security exclusion/zero API effects,
held POST handler guard, uncertain failed create, failed/current read recovery,
confirmed empty form, local failure and departure. All API and92 isolated browser
suites final0. Existing tasks-create-unknown first9/1: failed all-task recovery
filter/search/paused assertion failed; unchanged retry10/0. Exact cause not
established, no app/test fix, initial full log retained. Separate sync95+144=239
unique; native116+111+19=246total242unique/four startup repeats all inner/outer0.
Config16/14/docs4-138routes/reaper4 all0. Completed results preserved across continuation; staged, no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
