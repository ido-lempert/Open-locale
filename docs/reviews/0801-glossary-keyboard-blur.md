# Glossary actual keyboard blur-save checkpoint

## Developer
Two save fixture legs now type with real keyboard and Tab to blur, not synthetic
blur alone. Actual request hold/release and server read verify persisted text.
No application code changes. Local-edit lineage remains the734 implementation.

## Product
Validates complete typed text reaches existing save path and later local edits
survive earlier save confirmation. No new save or recovery capability claim.

## Designer
No UI/style changes or new screenshot claim. Keyboard draft retains all characters,
Tab triggers existing saving feedback, local unsaved and unknown states distinct.

## Security
Same local test accounts/API/PostgreSQL only. No external provider/credentials,
worker/license/spend/registration/share changes. Unknown write remains paused.

## QA/integration
- Actual keyboard/Tab/held-save/recovery browser15/0 exit0. Existing dropped-final-
keystroke negative detected/restored, exact persisted Submitted text asserted.
- Actual term-detail browser rerun green, including focused translation retained
without opening-editor blur-save, exact PATCH scope, stale editor, local download,
failed-write pause and no automatic replay.
- Glossary17 suites255 tests pass. Docs4 checks/138routes, syntax/diff pass.
- Test-only change, no production build/UI/full-product/native/sync/provider
rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING/external gaps unchanged.

Five review perspectives complete with no remaining scoped failure before commit.
