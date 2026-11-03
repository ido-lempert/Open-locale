# 0276 - Quality finding cardinality across locales

## Developer review
Dedicated real PostgreSQL/HTTP project with one key and en/he/fr translations.
Both target locales omit {name} and change123 to another number, producing four
findings on one distinct key. No application/query/schema change. Locale and
byType totals reconcile, sorted type/locale output asserted, and direct QA
endpoint cross-checked by finding count/key identity. Existing single-finding
per-key fixture remains. No promotion of coverage status.

## Product review
A finding is not a key: two findings per target locale on one key must display
four open findings across one key. Dedicated project avoids changing existing
usage and authorization fixtures. Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF
unchanged. No remote sync, baseline, worker or account changes.

## Designer review
No UI changes. Fresh native staged480x800 reports screenshot inspected: Quality
separates open findings and affected keys; locale/type table readable. Progress
retains existing horizontal scroll; full page continues below viewport. This
screenshot is the existing native fixture, NOT the new one-key HTTP fixture.

## Security review
Only local test data; no credentials in diff or new outgoing destinations.
Original owner's request verified before work. Existing project membership,
read token and revocation tests retained. Fixture creates its own project under
the same authenticated local test owner; no permission change or broader claim.

## QA/integration review
Reports114->117, API265/31 and web146/9 uncached RC0. All43unique integration/
config legs completed green across13properly completed batches inner/outer0.
Sync644/browser219/builds/reaper4/docs4/138routes green. Native STAGED116+128=
244total/242unique, PG55534 inner/outer0, checkpoint removed. NOT uninterrupted.
No application/test changes after native. Bundle warning unchanged563.45kB
against500kB. Docker static only, no daemon run claim.

Runner chronology: six nonexistent npm labels (workflow/jobs/machine/automation/
credentials/notifications) returned1/zero checks and batch rejected; recovered
exact labels from package.json. Combined C2+automations reached120s: C2 green
in log but outer interrupted; narrow C2A/C2B both subsequently completed0.
Automations isolated launch then failed before checks due to stale55470 lock;
validated lockPID5107 zombie and TCP111closed, removed only matching socket/
lock, isolated132green0. Combined E+2FA also hit120s after E green in log;
validated stale55474 lockPID6986 zombie/TCP111closed, removed matching files;
isolated2FA37green0. E rerun alone completed0. No test assertion failures.
All these runner failures/timeouts were reported to parent before commit.
