# Exact embed-origin Remove replacement preview

## Developer
Reviewed the exact filter against the existing removal handler. Returns a fresh array, removes every exact selected match, and preserves remaining order and duplicates. Existing confirmation, handlers and API unchanged. Indexed outer origin rows avoid duplicate identity collisions; wrapping is scoped to origin displays.

## Product
The existing confirmation shows the full outgoing loaded allowlist or explicit empty result for new embed requests. The text distinguishes local unsaved preview from a saved state, whole-list replacement from a conflict-checked merge, and loaded data from newer server values. No site ownership, trust, permission, sign-out or existing-frame-closing promise.

## Designer
Inspected desktop and 390px confirmation and accepted-result screenshots. Full 300-character origin wraps, ordered marker and confirmation buttons remain visible, no horizontal overflow. Accepted503 receipt and unsent draft remain readable. Mobile confirmation starts after the selected row above the viewport; this is not a claim that the whole section fits one screen.

## Security
Escaped remaining text, no generated links or URL repair, and no preview API/site requests. Existing explicit confirmation, busy/admin and server guards remain. Browser checks cover unconfirmed and mismatched removal, 403 retention, held-request duplicate prevention, actual database/CSP results and zero external requests.

## QA
11 new unit cases. API cached/web actual62s exit0; build actual11.7s exit0. Focus first20PASS/0. Temporary wrong-preview injection17PASS/3 targetedFAIL exit1, restored20PASS/0. Injection affected only the harness and was removed. Broad253 suites each in its own call, all FIRST exit0,3120PASS/0FAIL, no retries or app/fixture edits. API batches pass, sync browser95+144, native116+111+19 on PG56113; each browser/native stage separately invoked. Config16/14, docs4, harness3, runner4 pass. Final units/build cached exit0. This records staged verification across run boundaries, not a canonical uninterrupted run.

Coverage remains22FULL/7PARTIAL/1MISSING. Workers default OFF. External acceptance gaps remain unchanged, including accepted GitHub two-way remote write/baseline advance. No account registration, scope change, credential change, spend or license choice.
