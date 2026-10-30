# 0106 - Bounded comparison rendering and browser boundaries

## Developer pass
Render fifty comparison rows at a time. Computed slice and page count depend
on current result. Any input edit or new preview resets page index. Previous
and Next stay disabled at boundaries. Existing project-route subscription
clears files/results on same-component project navigation.

## Product pass
API still compares all allowed keys; pagination does not truncate the result
or change conflict/deletion decisions. Show total keys and current/total pages.
Local-file preview only; no apply, real provider verification or persistence.

## Designer pass
At 480px, page controls wrap within viewport and remain outside the horizontally
scrolling table. Screenshot inspected at last page. Full-page capture of the
long comparison showed a sticky header capture artifact, so switched decisive
pagination evidence to an actual viewport at the page controls instead.
No visual redesign or GitHub integration completion claim.

## Security pass
Real browser injects an HTML-shaped value supplied as remote file text and
checks literal rendering, no img element and no script side effect. This is
one discriminating rendering boundary, not broad XSS coverage. No new effect
or data disclosure. Same-component navigation proves old file text/results do
not carry into another project scope. Pagination limits live row DOM size,
not the bounded API response allocation.

## QA/integration pass
Focused real browser suite grows 12 -> 19 checks: literal untrusted rendering,
fifty-row bound, first/next/last page, new preview reset, same-component project
navigation reset. First attempt's two assertions ran before Angular rendered
the new page; added waits for actual visible next-page key, not arbitrary
sleep, then all pass. No app fix needed for those fixture failures.
Separate cleanup investigation: direct Nx web unit invocation returned a clean
outer envelope, while a direct four-command unit/build batch still produced
the known detached-child warning after individual RC0. Root cause unresolved.
