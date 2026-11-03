# 0268 - Report credential access after revocation

## Developer review
Test-only member-owned read token and existing session exercised across all four
report endpoints before/after committed membership removal and explicit re-add.
Then token revoked through normal API and compared with still-valid session.
No production changes.

## Product review
Team access is live, not frozen when credentials were created. Removal denies
subsequent report requests; explicit re-add restores same credentials. Token
revocation is independent from session. No in-flight revocation atomicity claim.
Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF unchanged.

## Designer review
No UI changes. Fresh480x900 local actor/task fixture inspected: identity rows and
counts readable, existing progress horizontal scroll retained. Image is not access
revocation proof; actualHTTP fixtures establish those responses. No UI cache or
client-memory erasure claim.

## Security review
Real authenticated HTTP requests use member-owned token, not owner's token with
pretend revoked membership. Committed DELETE precedes denied requests. Same
credentials regain access after explicit re-add, so initial denials are not merely
invalid credentials. Token DELETE then yields401 while same user's session200.
No external accounts/recipients or broader snapshot/freshness guarantee.

## QA/integration review
Reports79->97(+18): initialtoken4,removal1,session+token denial4,re-addsuccess4,
tokenrevocation1,revokedtoken401/session200four. API263/31/web146/9uncachedunchanged.
43unique legs/12fullycompletedgreenbatches individual/inner/outer0. Sync644/browser
212/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/interruption or
negativecontrol. Web562.75kBvs500warning remains. NativeSTAGED116+128=244total/
242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted. Noapp/testchanges
after native.
