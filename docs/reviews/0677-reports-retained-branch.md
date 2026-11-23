# Retain report branch outside options

## Developer
Exact selected branch gets a fallback option whenever its name is absent from loaded branches, including main with an empty list. Option reads never rewrite the selected branch or loaded figures. Independent branch-option refresh calls only existing listBranches; existing report refresh still uses the exact selected branch. No API change.

## Product
Prevents release reports being shown while the branch selector looks blank or silently suggests main. Notice names the selected branch and says loaded-option absence is not proof of availability or deletion. Usage/tasks remain project-wide. Retrying options does not imply reports are refreshed.

## Designer
Inspected actual desktop and390px screenshots. Short fallback copy and bounded select avoid long-name option overflow. Full branch name is in wrapping scope text, beside independent option-refresh guidance. Loaded progress/quality and separate project-dashboard scope remain readable; existing report tables keep their horizontal scroll containers.

## Security
No inferred branch identity, membership or permission. Exact string value remains text-bound, no dynamic HTML. No new mutation or destination. Existing server authorization and stale-response fences remain unchanged.

## QA and integration
- Focused report units60/0 including missing/restored/main fallback and failure recovery without report reads.
- Nonoverlapping web stages136files/1699tests +136files/1541tests =272unique files/3240tests. Staged, not uninterrupted.
- Enhanced real refresh browser10/0: empty branch list retains native release selection and loaded figures; independent option recovery makes zero sibling report reads;390px fit; existing report refresh still captures release and independent usage/task windows.
- Negative probe changed only fallback value to main. Exactly retained-release native-selection assertion failed,9pass/1fail,exit1. Restored10/0.
- Affected download6, project-download13, locale-search11 and saved-search report-context16 browser checks passed. Together with refresh,56 affected assertions.
- Real report HTTP/PostgreSQL118/0, API/web builds, docs consistency4/138routes, syntax and diff checks passed.
- One oversized regression batch hit its limit after browser checks and during report API startup. Rechecked no live processes, reran context suite with confirmed status. API retry exposed stale socket for verified zombie PostgreSQL3068; removed only that dead test socket/lock, reran118/0. Blocked run was not counted green.
- No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
