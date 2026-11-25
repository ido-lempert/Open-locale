# Glossary blur event row lineage

## Developer
Shared private resolver finds current row only by exact identity or matching
local-edit token. Setter and blur use it. Blur also requires resolved row remains
visible before passing current row to existing save method. Direct save method
semantics intentionally unchanged for internal call sites.

## Product
Late blur from refreshed same-ID snapshot cannot submit newer draft. Earlier
snapshot in same local typing chain can blur-save latest text. Search/attention-
hidden rows remain unable to trigger blur save. No auto recovery/retry added.

## Designer
No UI/layout changes or new screenshot claim. Existing saving/local draft and
unknown feedback behavior retained, actual keyboard Tab path rerun.

## Security
Local row lineage is not a fresh authorization check. Existing unknown-save/
delete/destroyed save guards apply. No provider/credentials/worker/license/spend/
registration/sharing scope changes.

## QA/integration
- Glossary17 suites257 tests: refreshed stale blur refuses, local predecessor
blur saves exact visible row, search-hidden predecessor refuses.
- By-ID-only blur source negative fails regression, restored local suite19/0.
- Actual keyboard/Tab/held-save/recovery browser15/0; metadata/current-stale
forced input+blur browser21/0, zero unintended writes/reads.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- Real API/PostgreSQL with controlled metadata fixtures. No full-product/native/
sync/provider/all-backend rerun claim. Latest full web736312 suites3820 tests.
Coverage22 FULL/7 PARTIAL/1 MISSING/external acceptance gaps unchanged.

Five review perspectives complete, no scoped failure remaining before commit.
