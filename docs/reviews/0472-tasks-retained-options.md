# 0472 Retain visible local task option selections

## Developer review
Computed missing member/group and selected-key IDs add fallback options only for
retained values absent from loaded lists. Namespace-aware group lookup; missing
key IDs deduplicated for rendering without mutating form array. Real options
replace fallbacks when recovered. Existing predecessor fallback retained. No
create API/payload/validation or option-read behavior changes.

## Product review
Unavailable options no longer make retained form IDs invisible. Scope explicitly
says local, not verified as available/allowed; review or clear before creating.
Backup preserves IDs with selectedIdsVerified:false, not validation. No inferred
permission, assignment, lock or create success. Server remains authoritative.
Fallback labels intentionally do not invent names for absent options.

## Design review
Desktop/390px screenshots inspected. Initial long assignee fallback extended past
the panel on mobile; shortened labels, rebuilt and recaptured. Final labels and
scope readable, no document overflow. Multiple absent keys share a generic label;
the backup retains exact IDs. No guessed names or disclosure of extra row data.

## Security review
Local display only. Member/group namespaces remain distinct. No new request,
storage, dependency, license, registration, spend, worker or credential scope.
No promotion of stale IDs to valid authority; backend checks unchanged.

## QA/integration review
Six units/web1042 in102 suites/API265 in31/both builds0 (API cached). New real
browser11/0: current empty/failed option reads, member/group/key retention, actual
backup IDs/unverified marker, real option recovery without duplicate choices,
clear/discard/project reset/zero writes and390px. Initial7PASS4FAIL fixture passed
raw key ID to Angular's encoded multi-select; corrected to actual rendered value.
App label shortened after visual review; rebuilt units/build/browser all0; initial
log retained. All API/99 isolated browsers final0. Existing identity-link-guards
twice preassertion PG55694 bind abort0PASS, unchanged delayed retry5/0; both logs
retained, no app/test fix for bind failures.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across continuation; staged/no uninterrupted claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged.
