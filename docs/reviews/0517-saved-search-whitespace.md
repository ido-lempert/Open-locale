# 0517 Whole-value search for whitespace-only saved text

## Developer review
Exact mode accepts nonempty whitespace query, unchanged bytes through existing
GET; contains mode keeps its non-whitespace gate, both modes still reject empty
or overlimit/unready/pending/departed query. No backend/schema change. Existing
mode clear/generation fences apply. Added10units, including tabs/NBSP at component
boundary; actual browser acceptance below is spaces, not every input method.

## Product review
Makes existing whole-value every-space-significant promise usable for all-space
saved values. It does not search missing/empty values, plural forms or drafts.
Help states exact whitespace versus contains/empty limits. Loaded all-whitespace
result now has explicit label and exact UTF-16 code-unit count; raw value/copy/
JSON stay unchanged. No automatic request, normalization or translation edit.

## Design review
Actual desktop390px pixels inspected: whitespace-only result no longer appears
as unexplained blank text; label wraps/readable/no horizontal overflow. Tall
mobile context card still scrolls. Count uses code units, not a false grapheme
or visible-character promise. Existing manual copy action remains available.

## Security review
Only broadens an existing read's client readiness gate in exact mode; existing
project/branch/locale authorization and literal escaped DB predicate unchanged.
No writes/storage/upload/credentials/audience/provider/worker change. Private
result clearing/fencing retains existing behavior. Interpolated fixed label.

## QA/integration review
New10units/fullweb1461/144/initialwebbuild0. Firstfocused13PASS1FAIL immediate
clear-control DOM race; added wait for rendered empty/default/disabled state,
no app fix, second/restored14/0. Full first log retained. Intentionaloldapp2PASS
then wait-for-enabled timeout1suiteabort/currentrestored/full log retained.
ActualPG one/three spaces distinct and excludes text/empty/otherbranchlocale;
manualEnter exact3spaces1GETzero writes, explicit label, actualclipboard3spaces,
parsedJSON exactquery/value, defaultcontainsblankguard, modeclears/heldlatefence,
clear/mobile/runtime. Focused never enables external providers. Finalunits/APItest/buildsbothcached0 afterinitialwebbuild0. APIa/b/c/dpreview644
2fa37SAML55firstRC0;automations132/0firstactual12unchanged-sourcebundlesseparately
prepared/tempharnessskiponlyesbuildwithexistencechecks/assertionssleepsDBunchanged/
fresh55857cleaned. Separate sync95+144239unique/native116+111+19246total242unique
4startuprepeat eachfirstinnerouter0/config16/14/docs4/reaper4all0. All144isolated
browser suites firstRC0,1577assertions/no failures/source changes. Checks
preserved across run pauses, staged not uninterrupted. README/plan updated;
finaldocs4/0RC0 and clean diff check.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
