# 0443 Loaded webhook journal JSON download

## Developer review
Explicit loaded readiness is false initially and at every reread, true only after
current successful read (including empty). Captured download handler refuses
pending/error/destroyed/unread state. Full loaded set exported, not filtered rows.
SchemaVersion1/projectId/webhookId/scope and explicit per-row whitelist preserve
scope without copying unknown future API fields. Temporary blob URL is revoked.
No API/schema/dependency changes.

## Product review
Download is local and explicit, up to50 retained loaded records, regardless of
search/status. No older history/newer server read, receiver-processing, retry/send
or sharing claim. Feedback says requested, not saved. Empty successful current
journal remains downloadable; failed read cannot masquerade as empty export.

## Design review
Actual desktop/390px download/count/filter/notice pixels inspected. Review found
only-displayed-metadata notice omitted that record IDs are exported; clarified to
record IDs and displayed delivery metadata, with private error exclusion. Final
wording followed by web units/build/new browser10/0 and renewed pixel inspection.
No horizontal overflow. Scope/private-data guidance remains visible by button.

## Security review
Explicit whitelist excludes raw API error/private network details, payloads and
signing secrets even if API returns extra fields. JSON escaping preserves literal
markup/newlines/non-Latin text, fixed filename avoids caller-controlled filenames.
Download is no-account-request/no-write and never shares externally. Original
owner upload instruction recovered; live exact repository checked before commit.
No worker/account/credential-scope change.

## QA/integration review
Unit7/web811 in73 suites/API265 in31 suites/builds0. New real local API/Postgres
browser10 verifies actual downloaded bytes, whitelist versus actual private API
error, combined filter/full loaded set, newer unread exclusion, no requests,
held read/captured handler, explicit refresh/new data, failure, new empty scope,
bounded local failure, destruction and narrow layout. Initial8PASS2FAIL then two
9PASS1FAIL: fixture expected all API fields (including intentionally excluded error
and duplicate webhookId) and sampled held-read feedback before DOM render. Fixed
expected explicit whitelist/semantic comparison and DOM wait; browser10/0. No app
fix from those failures. Existing QA-download initial1PASS1FAIL absent feedback
selector; unchanged6/0, added selector wait then6/0 (fixture only).
All API and70 isolated browsers final0, sync separate95/144=239unique; native
separate116/111/19=246total242unique/four repeats inner/outer0. These broad checks
preceded the final notice-only wording correction; final web811/73/build and new
browser10/0 cover that wording. Final configs16/14/docs4-138routes/reaper4 all0.
Checkpoints consumed; continued across run boundary without interrupted tests or
restarting completed broad checks. No canonical uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
