# 0342 - Snapshot pending capture draft retention and staged sync verification

## Developer review
Capture raw label before POST; submit trimmed label, clear only unchanged raw draft.
Two units cover newer label/duplicate guard/submitted value and unchanged clear.
No API/schema change. No application or snapshot-test edits after clean native stages; sync harness work
followed the timing blocker.

## Product review
A successful older capture must not discard the next label typed while pending.
No extra automatic capture; deliberate next submit remains required. Route reuse,
mutation error handling and late mutation destruction remain separate code work.

## Designer review
Inspected actual480x900 final pixels: captured Keep retry label row and retained
Newer pending snapshot draft input; capture control reenabled, no alert/loading.
No layout change or broader responsive/restore interaction claim.

## Security review
No new source/disclosure/account/provider/scope/spend/license/registration. Local
fixtures only. Existing mutation errors unchanged. Original authenticated owner upload recovered; live repository/push/admin/main
validated. Parent confirmed equivalent staged coverage resolves bounded hold.

## QA/integration review
API265/31/web280->282/14 uncached0/builds0. Snapshotbrowser5->7 actual heldPOST,
duplicate suppression/editable label and confirmed server old label/no newer capture.
All other47 integration/config legs completed0 including docs4/138routes; new
sync-browser-stage-config16 adds a49th unique leg. QA21/Activity28/
Tasks31/Glossary38, sync644/automation132/2FA37/reports118/reaper4 all0. Clean native
STAGED116+128=244total/242unique PG55534 both0/checkpointremoved, not uninterrupted.
Each browser/native stage isolated. No application/snapshot-test edits after clean native; later sync harness tests
verified separately.

Syncbrowser two isolated120s interruptions236/223checks, no failed assertions and no
final inner exit. First dead7453 PG55479 socket/interrupted descendants cleaned;
retry dead8008 socket/interrupted descendants cleaned. Next wake canonical isolated retry interrupted225checks/dead932, then temporary
no-screenshot harness interrupted196checks/dead1481. No assertions failed; no final
inner exit. Temporary harness removed; dead sockets and interrupted descendants
cleaned each time. Publication held during execution-path investigation; completed checks retained.
Staged verification below resolves bounded coverage; canonical remains unverified.

Bundle584.62->584.66kBvs500warning. Docker static-only; coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no accepted sync/baselineadvance/worker enablement;
report snapshot/window caveats remain.


## Staged harness developer/security/QA follow-through
Parent approved bounded investigation, not weakening checks. All235 original AST
check-call expressions unchanged and in order (239 runtime due loops). Split after
initial target route fences/before independent apply-project setup; no pending
requests or interception crosses split. Component-race tests stay within stages.
Second starts new browser/API, restored stopped PostgreSQL bytes and fixture
owner/member/project/second identities, repository bytes/counter and viewport.
Source+builtAPI+web hashes and database hash/private owned metadata checked before
startup; first-stage count95/failures0 and fixture metadata required. Actual project/
user IDs validated after restart. Same-user hostile rewriting is not prevented.
Local fixture tokens only, private temporary state never committed/shared.

Final exact harness first95/second144=239unique both inner/outer0; checkpoint removed.
16negative checks cover bad modes/path, public/symlink directory/metadata, source/app/
count/failure/fixture binding, changed DB bytes/symlink and occupied-port runtime
failure. Catch-path failure counter fixed during review before successful final
runs so exceptions cannot report green. First exploratory first-stage95 printed
inner0 but missing NX env left descendants; wrapper forced cleanup/outer1. Discarded
checkpoint; explicit NX env clean runs95/0+144/0, then final count guard added and
both final exact stages rerun95/0+144/0. No claim of uninterrupted canonical coverage.

Product: staged harness restores bounded verification under command ceiling rather
than dropping assertions; screenshots remain enabled. Designer: no UI change in
harness; existing snapshot screenshot remains evidence for draft retention. Cleanup
and restart caveats documented in docs/SYNC-BROWSER-STAGES.md. Completed unrelated
checks retained rather than rerun merely for new harness. No assertion failures in
canonical interruptions; those runs remain incomplete, not passing.
