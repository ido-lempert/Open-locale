# Actual refreshed glossary callback regression

## Developer
Browser captures row before actual explicit glossary API recovery read, invokes
its old input/blur callbacks afterward, and asserts no request/text/feedback
change. Test-only, no app code changed. Temporary reference removed after check.

## Product
Strengthens737 stale blur protection with actual backend-refreshed rows rather
than only local replacement fixtures. Existing rapid typing, held save and
unconfirmed outcome recovery exercised in same real workflow.

## Designer
No UI/layout changes or new screenshot claim. Current loaded value and existing
feedback remain instead of being replaced by stale callback text.

## Security
No new external effects, provider/credentials, worker/license/spend/share changes.
Three expected fixture PATCHes and one explicit browser recovery read remain the
entire write/read scope after setup. Old callbacks add neither.

## QA/integration
- Actual keyboard/Tab/held-save/later-edit/unknown-result/recovery browser16/0,
including old callback after actual API read and existing dropped-keystroke
negative/restoration. Initial edit helper syntax error changed nothing; reran
updated script after correcting helper, counted only final16-check version.
- Glossary17 suites257 tests green. Docs4 checks/138routes, syntax/diff pass.
- Real local API/PostgreSQL, not full-product/native/sync/provider/all-backend
rerun claim. Test-only, no production build rerun. Latest full web736 baseline
312 suites3820 tests; coverage22 FULL/7 PARTIAL/1 MISSING/external gaps unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
