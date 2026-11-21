# Group-member Remove loaded membership review

## Developer
Reuses fresh locale-array projection preserving exact raw order/duplicates without mutation. Exact group ID and membership user ID, loaded email and group role/scope stay separate from unsaved group/add-member drafts. Member wrapper changed from span to wrapping div for the block review section. Existing handler, guards and API unchanged.

## Product
Team-wide removal of this group's grant for the selected user still warns that direct membership and other group grants remain; group task assignments/tasks/translations stay unchanged. This is the group grant, not the member's direct role/scope or effective access. No newer-server/current permission/complete membership or task scan promise.

## Designer
Actual desktop/390px confirmation top/bottom and accepted receipt inspected17:41 and19:25 before commit. Same-name local group/member fixtures distinguished by exact pair IDs and email. Full220-character escaped email/300-character escaped locale/order/duplicates wrap390px, controls readable. Multiple scroll views; initial names/destructive warning above captured review, not one-screen claim. Accepted503receipt/unsentdraft retained. No app layout correction needed after initial implementation.

## Security
No new request, authorization or complete dependency/effective-access claim. Same-name/long email/unknown locale/role local metadata fixtures restored before API removal. Real PostgreSQL exact membership deletion only; direct and other group memberships remain. Lost group-admin request403/direct visibility retained across two projects. Group task assignments/tasks/translations unchanged, no deliveries. Existing exact pair/cancel/refusal/busy/pending guards verified.

## QA
9newunits actualweb62s/APIcached exit0; build10.7s0. FocusFIRST24PASS0FAIL. Harness-only runtime sorted/deduped locale projection23PASS1targetedFAILexit1/restored24PASS0, removed. No app changes since implementation. APIallbatches FIRST0 including644syncpreview/132automations/37twofa. Sync239 FIRST0. Native current246/0 PG56131: initialfirststage3startupPASS then screenshot write ENOENT exit1 because chosen output directory did not exist; created directory, unchanged same-port firststage retry116PASS0; middle111/tail19 FIRST0. Eachnative stage own call. Config16/14/docs4/harness3/runner4 FIRST0. Broad262allFIRSTexit0,3308PASS0FAIL, no broad exceptions/retries/app edits. Eachsuiteowncall across saved run boundaries. Finalcachedunitsbuild0; docs/syntax/diff checked before publication. Staged verification, not canonical uninterrupted-run claim.

Coverage22FULL/7PARTIAL/1MISSING/workersOFF/external acceptance gaps unchanged. No registration/token scope expansion/credential change/spend/license choice.
