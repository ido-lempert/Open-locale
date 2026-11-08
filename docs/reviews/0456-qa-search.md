# 0456 Search loaded QA findings

## Developer review
Local computed search intersects the existing type filter. Trimmed literal
case-insensitive substring matching covers key, locale and nullable detail; no
regular expression or server request. No-filter path retains original array
identity. Input/handler bound to 200 characters. Rerun keeps query/type, project
visit resets both, departed handlers refuse changes. Full findings remain loaded
and the existing download exports the full set regardless of search/type.

## Product review
Label and scope say loaded keys/locales/details, shown/loaded count and Clear.
Search does not rerun checks or inspect unsaved editor drafts. Filtered-empty
message offers clearing search/type rather than claiming no QA issues. Explicit
rerun and existing branch/locale scope stay distinct. Download warning updated
to name both local filters without changing exported contents.

## Design review
Final desktop and 390px pixels inspected: controls, scope, count and empty
feedback readable with no document or empty-cell horizontal overflow. Initial
empty table forced 680px and clipped guidance; empty-only min-width/header/wrap
rules fixed it, then stronger selector corrected a specificity conflict. Normal
populated table keeps its existing horizontal-scroll layout.

## Security review
Local literal match only, no HTML interpretation, external provider, writes,
automation enablement, registration, spend, credential scope or dependency change.
Existing private-content download warning and read/error/departed guards remain.
No API/schema changes. Owner upload request and current remote checked separately.

## QA/integration review
New unit4, web927 in86 suites, API265 in31, both builds0. Initial web925PASS/2FAIL
old type-filter tests required no-filter identity, restored fast path then927/0.
New browser initial4PASS then mobile clear timing timeout, then6PASS before a
fixture closure ReferenceError; explicit value waits and passed closure argument
fixed harness. Final browser10/0 after empty-layout pixel fixes and cell-overflow
assertion: actual key/locale/detail literal search, type intersection, full-set
JSON bytes despite no matches, zero search API effects, rerun retention, reused
project reset, departed handler and runtime-error check. Existing type fixture
scope assertion updated. All API groups and all83 isolated browser suites final0.
Separate sync95+144=239unique inner/outer0. Native first attempt failed one CRC UI
assertion then aborted at absent retry control: summary precedes follow-up key
read, so next upload ran while input disabled and was ignored. Harness now waits
for input enabled and no key-loading before next upload. Repeated failed first
stage116/0, then middle111/0 and tail19/0, total246/242unique with four startup
repeats, inner/outer0. No application change from native failure. Config16/14,
docs4-138routes and reaper4 all0. Completed independent checks preserved across
continuation; no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF
unchanged.
