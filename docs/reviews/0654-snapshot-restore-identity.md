# Snapshot Restore loaded identity review

## Developer
Pure loaded identity text reads exact project/snapshot IDs, raw capture time, kind and counts without mutating capture draft or row. Existing handler, before/after-confirm freshness guards, warning and API unchanged. Seven unit cases pass. No application changes after initial implementation.

## Product
Same-label captures can be distinguished before choosing Restore. Loaded counts are not current-project impact counts. Opening details neither captures nor restores. Unsent capture label and existing receipts remain independent. No parity or completion promotion.

## Designer
Desktop and 390px actual pixels inspected: ordinary expanded row, escaped 300-character ID with automatic kind/zero counts, desktop/mobile real restore receipt. IDs wrap without clipping controls. Long-ID fixture restored before actual restore. No markup execution.

## Security
Metadata-only limits explicitly exclude contents, newer server state, current permission and a current-project impact scan. Browser native confirmation retains existing restore warning. Canceled dialog sends no request/read. Accepted dialog whose loaded row is replaced cannot POST or remove the discriminating real key. No workers, external requests, credentials or permission changes.

## QA
Seven new units actual web66s/APIcached exit0; build9.6s0. Initial focus11/0. Strengthened first12PASS1FAIL: invalid raw capture-time fixture triggers existing DatePipe rendering error rather than a wrap failure. Corrected browser fixture retains real timestamp and uses escaped long ID;13/0. Invalid raw metadata remains pure-unit tested, no invalid-date UI support claim. Harness-only omitted-ID runtime mutation12/1 targetedFAILexit1; restored13/0 and temporary harness removed. API batches all first exit0, including644sync-preview/132automations/37twofa. Sync95+144=239 and native116+111+19=246 PG56135 each stage own call all first exit0. Config16/14/docs4/harness3/runner4 pass. One mistaken runner filename ENOENT, correct existing runner4pass. Broad264 CURRENTexit0/3338PASS0FAIL.018 first PG55536 bind abort0PASS1FAILexit1 before app checks, local55536 to API3000 TIME_WAIT06/inode0/no listener shown;45s unchanged same-port retry36/0 exit0. Other263 first exit0. No later app/fixture edits. Each browser suite and native stage its own call across saved boundaries. Staged verification, not a canonical uninterrupted-run claim. Final cached units/build, docs/syntax/diff and five pixels checked before publication.

Coverage remains22FULL/7PARTIAL/1MISSING. External acceptance gaps and workers-off state unchanged.
