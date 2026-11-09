# 0496 Safe focused local tag-editor opening

## Developer review
Shared readiness checks healthy loaded key, pending/unknown tag write and key
deletion/departure. Opening reads current loaded metadata, not a stale captured
object. Duplicate opening keeps the local tag draft. Pointer prevents translation
blur-autosave. Existing tag save/blur/uncertainty continuation is unchanged.

## Product review
Opening tags is local and makes zero requests. It retains focused translation
value and does not save tags or translations. This does not change the existing
save-on-blur/Enter behavior once the tag input itself is edited.

## Design review
Initial actual mobile pixels showed inline tag editing clipped adjacent controls.
Scoped mobile wrapping and full-width tag input fixed it; rebuilt, reran browser
and inspected final desktop/390px pixels. Mobile draft and adjacent controls are
readable. Desktop keeps its compact input; long text scrolls within it.

## Security review
Captured loading/error/saving/unknown/deleting/unknown-delete/absent/same/departed
opening refuses state replacement. Current loaded metadata avoids stale-object
seeding. No endpoint/auth/dependency/license/registration/spend/worker/credential
change. Tag mutation and unknown-result boundaries remain separate.

## QA/integration review
11 new units/web1294 in125/API265 in31/builds0(APIcached); full rerun0 after
design fix. Existing two-key unit fixture proactively grounds both loaded keys.
New browser6/0 initial/design rerun/sweep: stored tags/current local open,
focused pointer zero requests/no translation autosave/focus+value kept,
duplicate draft retained, absent-key refusal/390px adjacent controls/runtime.
Old-app first preassertion404: fixture PUT rather than actual PATCH; corrected
before app fix, then3PASS3FAIL exposes autosave/duplicate/absent behavior.
Both full logs retained. All API first-attempt0/123 isolated browsers final0.
Editor-tags054 first0PASS abort expected opener blur-save; explicit fixture blur
starts its intended held translation leg, then5/0/no app fix. Form-reset096
twice preassertionPG55744 bind abort0PASS, TIME_WAIT observed, unchanged delayed
17/0/no app-test fix/both full logs retained. Other suites first-attempt0.
Separate sync95+144=239unique/native116+111+19=246total242unique/four startup
repeats, every stage inner/outer0 first attempt. Config16/14/docs4-138routes/
reaper4 all0. Completed checks preserved across continuations; staged, not
uninterrupted. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
