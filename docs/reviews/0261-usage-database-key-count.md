# 0261 - Count active activity key names in PostgreSQL

## Developer review
Replaced the distinct-name findMany and array length with a parameterized SQL
COUNT(DISTINCT keyName). One scalar result reaches the API instead of all names.
The project UUID and captured inclusive since/asOf bounds are preserved. Count
conversion matches the existing report numeric contract. No schema change.

## Product review
Active keys still means distinct names in activity events, not live key IDs.
Null names are excluded; empty string is a distinct name, as before. Duplicate
names count once. Deleted-key activity is retained. No change to the trailing
window or top-five actor contract. Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING,
with the repository worker off by default. Separate queries are not one snapshot.

## Designer review
No UI change. Inspected the fresh local 480x900 actor fixture after browser212:
usage shows two events touching one key, separate full actor IDs, and group/user/
unassigned task rows. Content fits; progress table retains horizontal scrolling.
This screenshot is not SQL counting evidence. PostgreSQL HTTP fixtures are.

## Security review
Project authorization remains before aggregation. SQL uses bound values, not
string interpolation. Null, duplicate, out-of-window and other-project names do
not inflate the count. This reduces name materialization in the API, not database
CPU or memory bounds, and does not impose a timeout or change snapshot semantics.

## QA and integration review
Reports46 -> 48: actual PostgreSQL and HTTP fixture adds1500 distinct names plus a
duplicate, null, empty, old, future and other-project name. Exactly1501 extra names
count, other-project activity leaves it unchanged. Existing default/UTC/future/
permissions tests pass. API260 -> 261 tests in31 suites: unit verifies scalar result,
shared SQL values and no name findMany. Web146/9 unchanged.

43 unique integration/config legs in13 fully completed green batches; each leg,
batch and final outer command RC0. Sync644, browser212, reaper4, docs4/138 routes,
both builds green. Native staged116+128=244 total /242 unique, PG55534 inner/outer0,
checkpoint removed. Not an uninterrupted run. No app/test changes after native.
Web bundle warning562.75kB versus500kB remains.

### Failure and recovery chronology
- Initial API unit compilation failed TS2737 on BigInt literals under ES2015.
  Changed only fixture literals to BigInt(); final uncached31 suites/261 pass.
- Initial11-leg batch passed all legs and inner RC0, but outer RC1 reported detached
  child cleanup after bare Nx commands. Reran under existing reaper: all RC0.
- Combined C2/automation call hit120s: C2 completed green, automation interrupted.
  Verified postmaster zombie and closed55470 before removing stale socket files.
  Isolated automation132 passed. C2 later reran to establish full outer RC0.
- Combined mt/2FA/SAML/groups/plural/OIDC hit120s after2FA took about96s.
  First batch and groups/plural passed; OIDC interrupted. Verified zombie and closed
  55472 before stale socket cleanup. Isolated OIDC55 passed; mt/SAML/groups/plural
  and isolated2FA later reran with outer RC0. No assertion failures in those calls.
- No targeted old-source negative-control or measured performance benchmark claim.
