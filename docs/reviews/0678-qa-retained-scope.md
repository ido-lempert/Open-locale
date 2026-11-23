# Retain QA branch and locale outside options

## Developer
Exact-value fallback options cover selected branch and nonempty target locale absent from loaded options. Main with no branch options is also explicitly retained. Option refresh uses existing independently fenced reads, without scope mutation or rerunning QA. Findings and local search/type state remain untouched. No API change.

## Product
Stops findings for release/he appearing beside blank selectors. Missing loaded options do not imply deletion or current availability. Notice identifies both retained selections and states that option refresh does not rerun checks. Existing branch/locale changes still run checks in the explicitly chosen scope.

## Designer
Inspected actual desktop and390px screenshots. Short bounded selectors, wrapping full scope notice and separate option-refresh actions fit. A first visual showed adjacent branch/locale punctuation running together; replaced with separated punctuation and rechecked refreshed screenshots. Existing QA table retains its scroll container.

## Security
No identity or permission inference, no automatic scope substitution. Text/attribute binding only. No new endpoint or external destination. Existing server checks and stale-response guards remain in force.

## QA and integration
- Focused QA units33/0, covering exact missing/restored selectors, read failure retention and zero QA reads during option recovery.
- Nonoverlapping web stages136files/1702tests +136files/1541tests =272unique files/3243tests. Staged, not uninterrupted. One initial first-stage run was interrupted by a combined batch time limit; rerun completed green, no active processes remained.
- Enhanced branch-browser10/0 initial/restored: real release/he findings retained while branch and locale discovery return successful omitted options; exact native values,390px controls and independent recovery with no QA rerun.
- Negative probe changed only locale fallback value to empty. Exactly retained native scope assertion failed,9pass/1fail; restored10/0. Source restoration and all expected result counts checked after the batch interruption.
- Other affected QA browsers: baseline21, download6, search10, type7. Together54 affected browser assertions passed.
- Real QA HTTP/PostgreSQL checks, API/web builds, docs consistency4/138routes, script syntax and diff checks passed. No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
