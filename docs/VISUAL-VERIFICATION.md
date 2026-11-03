# Visual verification

Build the API first. The normal full run remains:

```
npm run test:visual
```

When the host limits command duration, run two stages with an explicit new,
absolute private checkpoint directory. Do not reuse another run's directory.

```
VISUAL_STAGE=first VISUAL_CHECKPOINT_DIR=/tmp/open-locale-visual-run npm run test:visual
VISUAL_STAGE=second VISUAL_CHECKPOINT_DIR=/tmp/open-locale-visual-run npm run test:visual
```

First-stage success is NOT a complete visual pass. It prints a stage-specific
marker, never the full success marker. The second stage resumes the same stopped
PostgreSQL data, project, browser token, URL and viewport. Checkpoint metadata
must be private, owned by the current user and tied to the exact runner source.
Both stage commands must exit0, with no FAIL lines. Together they run244 checks:
242 unique checks and two repeated API/web startup checks. This is staged
verification, not one uninterrupted browser session.

The checkpoint contains local fixture account/session data. It is removed after
stage2 or a handled stage failure. If interrupted by a host kill, clean up only
that run's processes and checkpoint, then restart from stage1. Never commit or
share a checkpoint. A source change invalidates the checkpoint. Negative
preflight checks run with `npm run test:visual-stage-config` and in the sweep.

If the default local PostgreSQL port55434 is occupied, use the same explicitly
chosen `VISUAL_TEST_PG_PORT` for both stages. Do not stop another process to free
it. The test-only override accepts1024-65535 and does not change application ports.
Incomplete cleanup is bounded; an exit guard allows exit0 only after the explicit
stage/full success path. The occupied-port regression proves startup failure
cannot be reported green, even if a dependency leaves an unresolved stop promise.

The translation-memory HTTP fixture similarly accepts `TM_TEST_PG_PORT` when its
default55442 is occupied. This changes only its isolated database port, not the
application API or test assertions. Do not stop another process to free a port.

Slice182 extends the repository recovery browser fixture with a real empty-string
archive review/recovery (fresh UNVERIFIED empty value,one history and intent),then
an independent32768UTF8byte Hebrew archive review. At480x900the exact-limit value
stays in its bounded scroll box with Prepare/Hide visible and no horizontal
page overflow. These are local fixtures,not external repository writes. The
fixture resets local effects between cases so later escaped-markup recovery
assertions still run independently. No app/server behavior changed.

Slice183 local injected available review with incomplete execution bindings stays
read-only at480x900:value/notice/Hide visible,Prepare/Confirm absent,no horizontal
page overflow. Browser197checks and unit projection guards cover this boundary.
No server change or claim that client validation authenticates a response.

Slice184 adds fixed read-only preparation guidance to the incomplete-binding
fixture. Final480x900image inspected with full original notice,value,new guidance,
Hide/focus outline visible,no Prepare/Confirm or horizontal overflow. Value-only
mode has no selected-target warning. Browser198checks.

Slice185 browser scope fixture uses complete well-shaped bindings with one
selected-target ID/revision/branch/locale mismatch per case. All stay read-only;
matching control exposes Prepare only. Final480x900locale-mismatchimage inspected
with notice/value/guidance/Hide/no Prepare/Confirm or horizontal overflow. These
are injected local review responses,not authority or server execution proof.

Slice186 report branch-switch fixture holds actual quality request,selects main,
then releases older branch. Final480x900image inspected:mainselected/progressand
qualitymain,usage/tasks visible. Existing table horizontal scrolling retained.
Browser205checks includes oldfigurescleared/newpairnot overwritten;image alone
is not late-response proof.

Slice187 same-component report navigation holds old project's actual usage request,
loads empty secondproject,then releases old response. Final480x900image inspected:
0keys/main/quality/usage/tasks,no oldfigures,Editorlink newproject. Browser207checks
prove late response does not replace new figures. Layout/table scrolling unchanged.

Slice188 local usage503fixture displays fixed unavailable/nofigures/reloadnotice,
retains successful tasks/progress/quality,and excludes rawdetail/usagetables.
Final480x900image inspected;existing table scrolling retained. Browser208checks.

Slice189 local quality503fixture shows full fixed branchreportunavailable/retry
notice,no progress/qualityfigures,retainsusage/tasks,norawdetails/staleloading.
Final480x900image inspected;layoutunchanged. Browser209checks.

Slice190 actualsame-nameassigneefixture renders two distinct fullIDrows and null
Noassigneebucket at480x900,eachcount1readable/tablefits. Finalimageinspected.
Browser210/reportsHTTP30 verify separateidentitycounts;noexternalaccountsused.

Slice191 local same-namegroup/personfixture at480x900shows GroupIDcue,twouserID
rows and nullNoassigneebucket,allfourcounts1readable/tablefits. Finalimage inspected
followingTLSreadretry. Browser211/reportsHTTP32 verifygroupseparation.
