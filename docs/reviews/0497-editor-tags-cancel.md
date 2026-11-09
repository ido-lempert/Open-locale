# 0497 Explicit local tag cancellation

## Developer review
Opening another tag editor now refuses while any tag editor is active, so a
captured cross-key call cannot overwrite the local tag draft. Cancel requires
current loaded healthy key/editor, no tag write/uncertainty or key deletion.
Cancel clears local editor/draft only; existing save/blur/Enter code unchanged.

## Product review
Cancel tags explicitly discards only this local tag edit, without saving tags,
translations or making requests. Loaded saved tags and local translation stay.
After cancel another loaded key can open. This is not undo for a submitted tag
write; pending/unknown writes keep their existing boundary.

## Design review
Actual desktop/390px pixels inspected. Focused tag draft, Cancel tags and local
translation are readable; mobile full-width field/wrapping retained. Desktop
compact input scrolls long text. Button title names local discard without save.
Pointer mousedown preserves focus until cancel, avoiding blur submission.

## Security review
Captured loading/error/saving/unknown/deleting/unknown-delete/absent/other/closed/
departed cancellation refuses. Delayed captured blur after cancel cannot submit
because the editor is closed. No API/storage/auth/dependency/license/registration/
spend/worker/credential change; submitted tag mutation semantics unchanged.

## QA/integration review
12newunits/web1306 in126/API265 in31/builds0(APIcached), first full pass0.
Focused browser5/0 initial+sweep: actual focused tag input, captured cross-key
refusal, pointer cancel zero requests/no tag save, translation/loaded saved tags
kept and next key opens. Intentional oldapp0PASS2FAIL: cross-key draft overwrite
assertion then expected missing cancel control abort; full log retained.
All API first-attempt0/124 isolated browsers final0, no post-fix test failure or
abort. Suite087 initial launch interrupted by provider before output, empty log
and no surviving process checked, unchanged rerun10/0; other suites first-attempt0.
Separate sync95+144=239unique/native116+111+19=246total242unique/four startup
repeats, every stage inner/outer0 first attempt. Config16/14/docs4-138routes/
reaper4 all0. Completed results retained across continuations and routine
session restart between suites; staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
