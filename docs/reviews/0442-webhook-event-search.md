# 0442 Loaded webhook event-name search

## Developer review
Computed trimmed literal case-insensitive substring over event names only, combined
with the existing recorded-status filter. Full loaded objects retained, bounded
200-character query, destroyed handler ignored. Current read retains filters;
webhook visit resets both. Existing read-generation/lifecycle/error fences remain.
No API/schema/dependency change.

## Product review
Search covers up to50 loaded deliveries only, not server history or receiver
processing. Clear event search leaves status intact; no-match guidance explains
how to widen results. Genuine empty journal stays distinct. Read-only, HTTP-only
and worker-default-OFF caveats remain; no send/retry/worker action added.

## Design review
Actual desktop/390px pixels inspected: search, combined filters, count, caveats
and long literal event readable without horizontal overflow. Angular interpolation
renders markup-shaped event text as text. Existing failure message stays visible
when search is cleared, never replaced by successful empty-state copy.

## Security review
Local filter issues no account reads/writes, matches only already authorized event
metadata and retains bounded error guidance. No secret/network detail is shown.
Original owner upload authority recovered from authenticated conversation and live
named repository target checked before commit. No credential or scope change.

## QA/integration review
Unit3/web804 in72 suites/API265 in31 suites/builds0. Dedicated real local API/
Postgres browser9 checks combined filters, literal no-match/full set, Clear without
requests, current reread preservation, failed read, route reset, narrow wrapping
and no secret disclosure. All API/isolated browsers final0. TM initial prestartup
port55442 bind abort ran0 assertions; unchanged repeat18/0. Existing status browser
initial5PASS1FAIL read-error wait timeout, unchanged repeat8/0; strengthened current
read completion wait to avoid matching old DOM, then8/0. No app fix for either.
Sync separate95/144=239unique; native separate116/111/19=246total242unique/four
startup repeats, inner/outer0. Final configs16/14/docs4-138routes/reaper4 all0.
Checkpoints consumed. Continued across run boundary with no interrupted tests or
restart of completed checks; no canonical uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
