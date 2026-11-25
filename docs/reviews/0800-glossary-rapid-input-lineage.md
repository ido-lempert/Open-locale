# Glossary rapid input lineage correction

## Developer
733 strict row identity lost rapid keyboard events while Angular handler still
held preceding immutable row. Private WeakMap tokens now connect only local-edit
replacements. Current row must be identical or share that exact edit token.
Refresh/reset/save-response replacements have no token and fence old snapshots.
No by-ID-only fallback. Weak keys avoid retaining old rows indefinitely.

## Product
Corrects733: normal typing must retain every character while old refreshed-row
callbacks remain rejected. Current local edit chain is not a stale read. Existing
blur-save, later edits during held save and uncertain-write recovery unchanged.

## Designer
No layout/style/visual changes and no new screenshot claim. Actual keyboard
input preservation matters more than synthetic input-only assertions.

## Security
Token is in-memory local lineage, not authorization or server-state proof.
Removed/refreshed/reset rows cannot adopt newer row identity by ID alone.
No provider/credentials/worker/license/spend/registration/sharing changes.

## QA/integration
- Real rapid keyboard browser initially reproduced lost characters under733.
- Post-fix glossary17 suites255 tests, actual keyboard/held-save/later-edit/
unknown-write/recovery browser15/0 exit0, metadata/stale-row browser21/0.
- First fixed keyboard run all15 assertions pass but reaper caught Nx descendants;
reran daemon/plugin isolation disabled, exit0. No hidden green exit claim.
- Strict-identity source negative fails rapid-event regression, restored local
suite17/0. Refresh/reset replacement and latest-edit lineage unit coverage.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- Real API/PostgreSQL browser validates actual blur-save and persistence, not a
full-product/native/sync/provider rerun. Full web728 baseline312 suites3796 tests;
coverage22 FULL/7 PARTIAL/1 MISSING/external acceptance gaps unchanged.

Five review perspectives complete; discovered733 regression fixed before commit.
