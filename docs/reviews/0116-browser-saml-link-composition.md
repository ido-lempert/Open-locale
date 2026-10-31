# 0116 - Browser SAML linking API composition

## Developer pass
Separate browser/start-link endpoint uses fresh password, session-only principal
and current epoch. Optional challenge on internal startLink composes existing
request-bound link state with browser handoff state. Register browser state
before link state, with no await between registrations, so capacity failure
cannot leave link state behind. Browser state retains explicit link purpose;
ACS forwards link RelayState only for that purpose, not ordinary browser login.

## Product pass
API groundwork, not a browser linking UI. Ordinary link and browser login paths
remain. Link completes at validated ACS; ticket redemption only delivers the
session or second-factor result. Failed redemption does not undo a link.
No external provider acceptance, distributed-store work or coverage promotion.

## Designer pass
No new page or UI change. Existing browser handoff safe error and second-factor
screens are exercised by the existing browser suite. Narrow callback screenshot
inspected; this does not demonstrate a new linking UI or click-through flow.

## Security pass
Session/fresh-password/epoch controls reused. Verifier required for browser
result delivery. Exact request and stored purpose binding prevent RelayState
swaps/stripping from becoming ordinary login. Conflict and stale epoch failures
produce fixed verifier-protected error handoffs, without raw XML diagnostics.
Existing signature verification is unchanged. No credentials, external accounts
or provider registration added. Stores remain process-local and bounded.

## QA/integration pass
Added22 real signed-mock-issuer/API/PostgreSQL checks to existing35 browser
checks. Assert no unauthenticated/wrong-password/invalid-challenge start, fixed
303 no-store handoff, original account session and identity binding without
asserted-email provisioning, collision preservation, verifier rejection/burn,
no rollback on failed redemption, stripped/swapped request rejection and no
binding, second-factor result/completion, stale epoch/no binding.
Initial failures were fixture errors: duplicate variable, using an old
non-2FA session after enabling fixture2FA, then misspelled Prisma accessor.
Corrected fixture sequencing/accessor. Added real API-token principal rejection
with a separately asserted valid-token fixture. Docs consistency caught the new
route missing from OpenAPI; added it before rerunning checks.

Verification status before commit:46 unique sweep legs pass individually after
OpenAPI fix (API205/24 suites, web24/5, both builds, four reaper checks,41
integration legs including SAML browser/HTTP57). Initial docs leg failed2/4
checks because new route was undocumented; rerun passes4. Broad visual is NOT
verified for this change: three runs exceeded120-second execution windows at
187,190,187 checks without FAIL lines, never reaching final completion. All
known interrupted test browser/server groups and confirmed-dead PG socket
cleaned. No commit until the remaining visual verification is completed through
a bounded runner or slower execution route; do not label this envelope clean.

Visual follow-through: completed unchanged assertions through a temporary
checkpoint split at the import/settings boundary. Stage1 ran116 checks, stage2
ran128 (two repeated API/web startup checks);242 unique checks, every source assertion label present (245 label occurrences
include repeated/conditional assertions). Dynamic comment
timestamps and API docs counts differ from the prior run as expected (new route
increases documented operations118->119 and paths91->92). Both inner and outer RC0. The
checkpoint copies stopped PostgreSQL data and browser token/URL/viewport, then
resumes the same project. First split attempt's116 assertions passed but copying
auto-deleted nonpersistent PG data failedRC1; switched temporary PG to persistent
and reran both stages cleanly. This verifies assertions in two stages, not a
single uninterrupted broad run. Temporary runner/checkpoint removed afterwards.
