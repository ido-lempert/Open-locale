# 0379 - Retained OTA publication inspection

## Developer review
Dedicated member-authenticated version/locale route with branch query; settings
links each publication locale. Typed existing API read URL-encodes all parameters.
combineLatest observes route and query changes, generation/destroy fences old
success/error/finally including repeated scope. Every read clears previous private
bytes/page; duplicate pending refresh disabled. Fifty-row local rendering pages
with bounded indices; full bundle still fetched, not server pagination. Five unit
cases. Existing API version+branch-name semantics preserved, not UUID-bound
permanent links across branch deletion/recreation; no immutable URL guarantee.

## Product review
Inspect retained publication without publishing: branch/version/locale, published
time+zone, project slug/count, exact displayed strings and explicit empty marker.
Visible published-not-live/unreviewed-values/25-retention/not-client-delivery scope.
No download/integrity verification, CDN/native SDK, release approval, edit/republish
or automatic watch claim. Branch recreation may reuse a version under existing API
semantics; this is a current retained-branch lookup, not a permanent archive link.
Coverage22FULL/7PARTIAL/1MISSING unchanged; OTA external acceptance still partial.

## Designer review
Actual desktop1278x899 and390x844 mobile/error pixels inspected. Long literal HTML
text wraps with preserved whitespace, empty value distinct. Review moved pagination
above long rows so controls are reachable before long payloads. Final viewport
screenshots inspected after rebuild/rerun; no overlap/horizontal overflow. List
polite announcements, pending status/disabled refresh, fixed alert. Values can be
long and page remains vertically scrollable; no truncation claimed.

## Security review
Member read auth enforced by existing API; browser real ordinary-member allowed
and unrelated-account404. No API/schema/auth changes. Translation text plain Angular
interpolation, no HTML interpretation. Raw errors omitted and stale values cleared
on refresh/error/scope change. No new audience, external service, worker/credential/
spend/license changes. Existing repo upload authority recovered before publication.

## QA/integration review
API265/31 web318/16 uncached, both builds0. New actual DB/API/browser17 final0:
settings link/exact retained scope; published bytes unaffected by live change;
empty/hostile literal values;50+1 pages; query-only branch and locale route reuse;
held duplicate refresh/error/retry; ordinary member and outsider404; deleted
version404; zero read-flow mutations; no runtime error/mobile overflow.
Initial fixture invalid spaced branch rejected400,0checks1. Valid branch fix yielded
14PASS2FAIL: immediate click assertions raced render and assumed insertion-order
last key despite database JSON ordering. Corrected wait and last-page count-only,
no app fix;16PASS0 then strengthened outsider404 final17PASS0. Explicit encoding
still used in client, but invalid spaced branch is not claimed supported.
All51 bounded integration/config legs final inner/outer0, prior50 plus OTA browser.
Docs4/138routes, config16/reaper4. Sync95+144=239unique and native116+128=244total/
242unique final STAGED inner/outer0, checkpointsremoved. Never canonical
uninterrupted success. No app/test edits after stages. Docker static-only,
worker defaultOFF, external sync unaccepted. Bundle warning recorded below.

Final bundle 597.29kB vs500kB warning (previous591.78kB).
