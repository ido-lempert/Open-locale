# 0474 Loaded report locale search

## Developer review
Trimmed case-insensitive literal locale-code matching in computed views of loaded
progress/quality arrays. Full reports and status columns stay unchanged. Capped
input, departed guard, refresh/branch retention and project reset. No API change.

## Product review
Find locale rows without changing totals or sibling usage/task figures. Explicit
loaded-only scope, shown/loaded counts, filtered-empty versus actual-empty copy.
Branch JSON continues to include every loaded locale, even with no visible rows.
No implied server search, current snapshot, or recomputation.

## Design review
Desktop and390px screenshots inspected. Initial mobile progress empty guidance
clipped inside wide scrolling table; added readable guidance outside that scroll
area and rebuilt/retested/recaptured. Search, clear, counts and independent
sections fit without document overflow. Existing wide table scroll retained.

## Security review
Local read-only filtering: no requests/storage/dependencies/licenses/registration,
worker enablement/spend/credential changes. JSON private-data scope unchanged.
Literal includes does not interpret expressions; no new HTML injection surface.

## QA/integration review
Six units/web1056 in104 suites/API265 in31/both builds0 (API cached). Initial
unit fixture omitted byStatus and failed one test; fixed fixture, full rerun0.
New real browser11/0 before and after design fix, then11/0 in full sweep: actual
three locales/quality findings, trimmed mixed-case search, unchanged totals and
siblings, literal no-match, actual complete JSON, clear, explicit refresh two
reads, branch retention, project reset/actual zero quality, departure and390px.
All API/101 isolated browsers final0, no existing regression failures this slice.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats all inner/outer0. Completed results preserved across continuation; staged
verification, not an uninterrupted run. Config16/14/docs4-138routes/reaper4 all0.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
