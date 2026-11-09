# 0488 Safe focused memory recovery reads

## Developer review
Dedicated retry requires current loaded key, selected target, failed read and
all existing target readiness checks except that read error. Shared helper keeps
healthy refresh/apply semantics unchanged. Pending read, key/grid/deletion state,
bulk/import, dirty/saving/reviewing/unknown target, changed source and departure
refuse. Existing reader owns generation/source/target fencing. No API change.

## Product review
Raw failed-read retry bypassed eligibility checks and moved focus off the empty
target. Guarded retry now preserves focus and reads only memory for the current
source/target locale. Actual saved suggestion appears without apply or save.
Failed reads keep fixed error/no stale suggestions. At most three suggestions;
no automatic translation, editor reload or provider/worker change.

## Design review
Final actual error desktop/390px pixels inspected. Empty target remains focused,
full-width mobile input and fixed error/retry readable. Existing healthy scope
is intentionally absent in error state. No layout/copy change.

## Security review
No endpoint/dependency/license/registration/spend/credential change. Guarded
captured retry refuses healthy/pending/unavailable state; backend error text not
shown. Shared readiness does not loosen apply. No unrelated read or write.

## QA/integration review
19 new units/web1226 in118 suites/API265 in31/builds0(finalcached).
Initial healthy-unit fixture incorrectly set error true; fixed false, all units
rerun0. Intentional old-app discriminator1PASS2FAIL: focus-loss assertion then
missing-new-handler abort. Initial after-fix browser5PASS then expected healthy-only
scope selector in error state; fixture corrected. Two subsequent7PASS runs outer1
because reaper forced descendant cleanup; direct runs lacked standard NX daemon/
isolation flags. Unchanged app/browser with flags7PASS inner/outer0, then sweep7/0.
Exact leftover process identity not proven. All full logs retained.
Real history-independent memory503/held retry one memory-only read/zero writes,
empty-target focus, actual stored suggestion/no apply, duplicate/healthy guard,
fixed error and390px covered. All115 isolated browser full-sweep first attempts0.
All API final0: initial TM preassertionPG55442 bind abort0PASS, unchanged retry18/0,
no app/test fix/full log retained. Separate sync95+144=239unique; native116+111+19=
246total242unique/four startup repeats, each inner/outer0 first pass. Config16/14/
docs4-138routes/reaper4 all0. Completed checks preserved across continuations;
staged, not uninterrupted. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
