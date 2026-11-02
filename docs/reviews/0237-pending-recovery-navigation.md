# 0237 - Pending recovery and navigation after commit

## Developer pass
Explicit recovery has a separate pending signal,cleared on result,route load or
destruction. Existing generation fence protects late result and delayed focus.
Private review/bindings still clear before POST;busy prevents a second send.
Pending and final status share focus/scroll helper. Removed duplicate audit-loading
reset. No server changes.

## Product pass
Pending notice states request sent,waiting for result,leaving does not cancel,
check current value before another recovery. It does not claim success/rollback.
After navigation the new route is clean,not a durable outcome notification;return
and check current value. No automatic retry. Coverage22FULL/7PARTIAL/1MISSING/default
OFF unchanged,no remote write/baseline advance/sync acceptance/worker enablement.

## Designer pass
Actual480x900 pending screenshot inspected twice,including final run. Entire notice
below configuration banner readable,private value absent,disabled refresh/audit/
scope controls visible. Long target option truncates inside select;card continues
below viewport. No horizontal overflow visible. Pending status gets keyboard focus;
late result must not steal focus from new route. Fixture data only.

## Security pass
One actual authenticated browser POST goes to local API. Fixture waits for201/body
then holds response while same component changes project route. Exact original
project value/history/intent persists once;new project receives no private review,
old success or pending notice. Focus stays on new target-owner input. Navigation
is not transaction cancellation or memory erasure. No new grant/API/no targeted
negative-control claim.

## QA/integration pass
Web82->85/7(+3pending/no-second-send/error/route-destroy cases),API248/30 unchanged.
Browser167->170(+3pending/route-fence/persisted-commit checks). Initial and final
web/browserRC0. Sync644;43unique integration/config legs in10completed green batches,
individual/outerRC0. Both builds,reaper4,docs4/138routesRC0. Existing web~555kBvs500kB
budget warning remains,not build failure. Native STAGED116+128=244total/242unique,
inner/outerRC0,checkpoint removed,not uninterrupted. No app/test change afterward;
web85/browser170 reran,then docs only.

Two batched verification calls exceeded120seconds. First interrupted plural startup;
verified zombie PID+closed port and removed stale socket before narrower reruns.
Second completed federation batch then interrupted SAML browser startup. Two SAML
retries had zero passes/one suite-abort failure due stale socket,not accepted green.
Cleanup scripts initially stopped on conservative process-identity assertions,
without killing an unverified process;by next inspection old service was zombie.
Verified database zombie+closed port,removed stale socket,then SAML61 and the full
narrow batch passed. No incomplete/zero-check run counted green. No application
assertion failure171. No external exactly-once/delivery claim.
