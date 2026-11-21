# Snapshot metadata display fallback

## Developer
Invalid capture times no longer throw out the row render. DatePipe short formatting still uses the injected Angular locale for valid strings. Empty/nonstring/throwing inputs show unavailable. Strict boolean classification used in both loaded detail and native confirmation. Existing restore handlers/API/freshness guards unchanged. Raw metadata preserved, not repaired.

## Product
Unknown kind is not silently described as manual or automatic. Kind filters retain existing strict classification. Fallback is not snapshot validation or permission/readiness assurance. Capture draft and receipts remain independent; explicit read can replace malformed metadata. No parity promotion.

## Designer
Actual desktop/390px pixels inspected for fallback and recovered rows. Review caught preexisting truthy auto badge contradicting unknown detail, fixed to strict true badge and explicit unknown kind. Escaped300-character raw timestamp wraps and row controls remain readable. No markup execution.

## Security
No writes/external calls caused by display helpers or review. Canceled confirmation preserves raw timestamp and unknown kind without restore/read. API and freshness/unknown-outcome guards unchanged. Runtime truthy-kind mutation discriminates with targeted browser failures. No workers or credentials changed.

## QA
20newunits first actualweb65s/APIcached0/build9.1s0. Focus first6PASS1abort: recovery wait incorrectly treated absent row as ready. Fixture wait corrected8/0. Harness-only truthy-kind mutation6PASS2targetedFAILexit1/restored8/0, removed. Visual badge fix build9.5s0/focus8/0/postfixactualweb58.9s/APIcached0. API all batches first0 including644sync-preview/132automations/37twofa. Sync95+144=239/native116+111+19=246PG56137 first0, each native stage own call. Config16/14/docs4/harness3/runner4 first0/syntaxdiff0. Broad265CURRENTexit0/3346PASS0FAIL.019 first PG55664 bind abort0PASS1FAILexit1 before app checks23:56:41 Nov21; socket55664to55536TIME_WAIT06/inode0/no listener shown;45s unchanged sameportretry6/0exit0.141 first PG55790 bind abort0PASS1FAILexit1 before app checks00:40:16 Nov22; socket55790toAPI3000TIME_WAIT06/inode0/no listener shown;45s unchanged sameportretry8/0exit0. Other263 first0; no further app/fixture edits after badge fix. Each browser suite own call across saved boundaries. Staged verification, not canonical uninterrupted-run claim. Final cached units/build/docs/syntax/diff and four pixels checked before publication.

Coverage22FULL/7PARTIAL/1MISSING, workersOFF and external acceptance gaps unchanged.
