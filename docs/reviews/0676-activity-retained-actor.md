# Retain activity actor filter outside options

## Developer
A selected actor ID absent from current member options gets an exact-value fallback option. The filter signal is never cleared or rewritten by option absence, read failure or recovery. Existing server reads keep sending the exact selected ID. Refresh actor options invokes only the existing member read. No new API or audit semantics.

## Product
Prevents an active historical actor filter from looking blank or unfiltered when current project members no longer include that actor. The fallback deliberately names no person and does not label the actor deleted. Notice says loaded options, not current membership or permission. Choosing all actors removes the filter through the existing flow.

## Designer
Initial390px screenshot exposed overflow from the long ID in the select. Shortened option copy and constrained native select width; the complete ID remains in a wrapping status notice. Reinspected updated desktop and390px screenshots: fallback, full ID notice and option-refresh action fit without horizontal overflow. Added an actual option-refresh button because the existing retry action is shown only on read failures, not successful empty lists.

## Security
No identity inference from a missing option and no permission claim. Exact existing selected ID remains in bound option value; interpolation is text-only. No new disclosure or mutation. Activity remains independently available and its server-side authorization remains unchanged.

## QA and integration
- Focused activity units60/0: missing/restored/empty options, failure/recovery, exact retained filter ID and explicit clear.
- Nonoverlapping web stages136files/1696tests +136files/1541tests =272 unique files/3237tests. Staged, not uninterrupted.
- Enhanced real clear-browser13/0: actual member read overridden to successful empty list retains native selection; actual Refresh actor options restores normal option without clearing actor;390px fit plus existing filter races/local search/retry/pagination checks.
- Negative probe changed only fallback option value to empty. Exactly native retained-selection assertion failed,12pass/1fail,exit1. Source restored13/0.
- Other affected activity browser36/0 and download11/0, totaling60 affected browser assertions. Real activity API32/0.
- API/web builds, docs consistency4/138routes, script syntax and diff checks passed. No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
