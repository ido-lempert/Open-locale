# 0129 - Deployment-scoped repository reads

## Developer pass
Target read endpoint requires expectedRevision and session admin. Deployment
reader uses exact GITHUB_READ_OWNER/REPO/TOKEN, no other credential fallback.
Pinned contents client freshly reads bounded bytes, validates SHA/UTF8/flat JSON.
Recheck target revision/existence and admin after network before disclosing bytes.
No retries, baseline acceptance, writes or persistence. Sanitized503 missing scope,
502 upstream/unsupported data,409 stale target. No-store response.

## Product pass
First authenticated repository-read composition, still not two-way sync or an
accepted baseline. Operator must separately provision authorized read-only access;
this code does not enroll credentials, register an app or expand token scopes.
No environment token configured outside fixtures during this work. No read UI
or connection claim in existing config UI. README documents scope and caveats.
RemoteVerified means fetched bytes passed transport consistency checks, not that
local/remote state was synchronized. canApply=false,baselineAccepted=false.

## Designer pass
No UI change. Existing config UI58 real browser checks retained; no new screenshot
claims. HTTP errors are bounded and actionable without upstream private details.
Future UI must identify verified file snapshot separately from accepted baseline.

## Security pass
Credential supplied only by deployment secrets for exact repository, never body
or publishing credential. Fixed production origin, loopback override test-only,
production ignores override. Shared validation runs before selection. Member/
outsider/API-token/stale revision rejected before outbound call. Held-response
fixtures prove lost admin or changed target returns no bytes. No-store, no stored
file contents/token, no upstream error body. Existing pinned redirect/DNS/blob
SHA/size/UTF8 guards retained. Deployment secret remains operator authority.

## QA/integration pass
API240->244 tests in28->29 suites: four reader configuration tests. Real DB/HTTP
sync93->105 checks: exact verified bytes, GET credential, no persistence/no-store,
stale and role/token denial before network, nested JSON502, upstream403 sanitized,
missing scoped repo503 without caller token fallback, target change/lost admin
during held remote read. Fixture server only, no external GitHub acceptance.
Web35/7, both builds/reaper4 RC0.43 integration/config legs in nine completed
fail-closed batches all individual/outerRC0; units/builds/reaper give48-leg sweep
inventory. Native visual116+128=244 total/two repeated startups/242 unique, every
source assertion covered, both inner/outerRC0; checkpoint removed. Staged, not
uninterrupted. No new UI screenshot. Coverage unchanged.

One combined verification call reached120sec after2FA37/RC0 and web unit success,
during API build. Incomplete build not counted; reran API/web builds, web units
and reaper in a bounded call, all RC0. No app assertion failures this slice and
no active services retained. No failed or interrupted result promoted to green.
