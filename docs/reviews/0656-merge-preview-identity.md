# Merge preview request identity

## Developer
- Existing merge preview now displays project ID, captured source branch ID/name, fixed target main and the raw preview timestamp. No merge API, controller or request guard changed.
- Five new unit checks cover captured identity, unchanged confirmation binding after branch-list replacement, cancel/no request, draft separation and raw timestamp preservation.
- Unit tests and production builds passed. Initial actual web test run took 107 seconds; API tests were cached. Final all-project test/build check passed with four cache hits.
- Focused browser first run was 8 PASS / 1 FAIL: the test expected request property names that differ from the existing API client. Corrected the test to the existing into/previewedAt contract, without changing application behavior; corrected and restored runs were 9/0.

## Product
- Identity is explicitly limited to the loaded preview. It does not claim current permission, a complete conflict scan or completed execution.
- Existing copy-forward explanation, overwrite warning and counts remain. Saved source values, local unsaved translation drafts and an unsent branch-name draft remain distinct.
- Real browser confirmation sent the displayed source ID, target and timestamp once. Main received the saved source value; the source and local draft remained unchanged. Cancel caused neither merge nor grid reload.

## Designer
- Inspected actual desktop, 390px top/bottom, long-metadata and post-merge screenshots after the full regression sweep.
- Existing modal now scrolls within the viewport and wraps long metadata. Desktop identity and overwrite warning are readable. On 390px the identity and warning remain readable, with both actions reachable by scrolling.
- Long markup-like identifiers render as text and wrap without horizontal modal overflow. Long test metadata was canceled before a real merge. No claim of a new focus trap or broader accessibility work.

## Security
- Angular text interpolation is retained for identifiers and timestamps; the long markup-like fixture created no image element.
- No API authority, credential, permission, merge policy or worker changes. Existing server guard coverage remains in regression.
- Test-only negative probe removed the displayed timestamp and produced 8 PASS / 1 targeted FAIL, exit 1. Restored harness passed 9/0; temporary probe removed.

## QA and integration
- Focused browser: corrected/restored 9/0; broad suite includes it at 063 and existing merge checks at 064.
- Broad browser sweep: all 266 suites passed on their first attempt, 3355 PASS / 0 FAIL, with each suite run separately. No application edits or sweep exceptions.
- API and integration legs passed, including sync preview 644, automations 132 and two-factor 37. Sync stages passed 95+144=239. Native stages passed 116+111+19=246 on PostgreSQL port 56139, each stage run separately. These are staged checks, not a single uninterrupted native run.
- Configuration checks passed 16/14, documentation 4, harness 3 and runner 4. Final documentation, syntax and whitespace checks passed.
- Existing external acceptance gaps and feature coverage classification remain unchanged. Local fixtures are not production provider acceptance.
