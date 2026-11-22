# Screenshot deletion confirmation

## Developer
Reviewed exact key and screenshot object identity, captured IDs/name/filename,
project/branch, project/grid/pane generations and serialized screenshot metadata.
Confirmation clears its capture before checking it and calling the unchanged
delete lifecycle. Project load, grid clearing, pane read/close and screenshot
mutation invalidate the decision. Current grid/pane loading, errors and unknown
write states still block it. No application edits were needed after initial
implementation.

## Product
The first click makes no request. A separate choice names the selected stored
image and its loaded key, branch and project. The warning matches the API and
schema: delete the selected screenshot record and its image bytes, not the key,
translations, comments or other images. It does not promise undo, current server
state or fresh permission. Confirmed deletion keeps the screenshot-only refresh;
existing unknown-result recovery remains available.

## Designer
Inspected desktop, 390px mobile, long escaped mobile metadata at both scroll
positions and the post-delete result. Warning, identity and both choices are
readable. Long metadata wraps without horizontal overflow; vertical scrolling
reaches both choices. Pointer opening, cancel and confirm prevent a translation
blur-save. This is not a claim of complete keyboard/focus-trap accessibility.

## Security
Angular text interpolation escapes identity fields. Markup-like long metadata
remains text. Exact captured identity and generation checks reject stale or
replaced rows, screenshots and panes. Server permission and delete endpoints are
unchanged; the loaded-state wording does not replace their authority. Workers
remain off. No new registration, spend, credential change, scope expansion or
license choice.

## QA / integration
- 30 new unit cases. The initial web run reached its 120-second execution ceiling
  after 258 completed suite PASS markers, no FAIL and no final summary. The
  configured list contained 268 unique paths. Only the ten missing paths were
  continued: 65 tests passed. That initial tail used no process-reaping wrapper;
  Jest exited 0 but outer cleanup exited 1 after terminating a detached child.
  Re-running only those ten under the normal wrapper passed 65 tests, with Jest
  and wrapper exit 0. This is staged coverage of 268 files, not an uninterrupted
  full-web-unit pass or an observed aggregate test-count summary.
- Initial focused browser run: 11 PASS / 1 FAIL, exit 1. The long-fixture cancel
  assertion checked before modal removal rendered. Added a hidden-selector wait
  in the harness only. Corrected and restored runs: 12 PASS / 0 FAIL, exit 0.
- A temporary harness that omitted the displayed screenshot ID produced the
  targeted 11 PASS / 1 FAIL, exit 1. It was removed before the restored pass.
- Real pointer open/cancel preserves focused local translation and new-key form,
  both stored screenshots and no PUT/DELETE/GET. Real refresh and close/reopen
  reject old captures. Confirm deletes the exact selected image once, reads only
  screenshot data and retains the other image, persisted translation, local
  draft and key form. Existing write (6) and read-recovery (8) checks passed.
- Broad browser regression: 270 suites, each first-run exit 0, 3402 PASS, 0 FAIL.
  Each suite ran separately. No application changes during the sweep.
- Final QA corrected the new harness abort counter and copied header. Focused
  rerun: 12 PASS / 0 FAIL, exit 0. A temporary early-abort probe then correctly
  exited 1 and was removed. This harness-only change does not change application
  behavior or relabel the completed broad sweep as a later run.
- API regression legs passed, including sync preview 644, automations 132 and
  2FA 37. Sync browser stages: 95 + 144 = 239 checks, both first-run exit 0.
  Native UI stages: 116 + 111 + 19 = 246 checks, all first-run exit 0, each in its
  own call. These are staged checks, not one uninterrupted invocation.
- Final build: 2/2 cached, exit 0; API unit cache: exit 0. Docs 4, sync-stage
  configuration 16, native-stage configuration 14, reset harness 3 and process
  runner 4 checks passed. Three changed browser scripts passed syntax checks;
  diff check passed. A final runner invocation initially used a nonexistent
  filename; the correct reaped-runner-test.py then passed all four checks. No
  whole-web cache or uninterrupted full-unit claim.

Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING. External runtime/receiver/CDN,
real provider/SSO and accepted GitHub two-way remote-write evidence remain outside
this local confirmation slice.
