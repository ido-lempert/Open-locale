# Report/QA harness PostgreSQL override preflight

## Developer
Shared narrow validator checks supported command shape, mapping identifier,
and exactly one PG_PORT numeric environment fallback declaration matching
the registry. Registry validates all entries before any case spawns. Source
shape changes fail closed for review, rather than guessing a variable name.
Fast preflight mode skips PostgreSQL/browser cases, not actual startup tests.

## Product
This improves test reliability after755 incorrect-port retry. It is not a
product feature or new application acceptance. Regular harness occupied-port
checks are unchanged. Optional filter still scopes which startup cases run.

## Designer
No UI/copy/layout changes; no screenshot needed or changed-pixels claim.

## Security
Validator rejects unsupported shell-style commands, absent/invalid mapping,
wrong/missing/duplicate supported port declarations. Does not claim to parse
arbitrary JavaScript or verify script identity. Existing spawn remains argv,
not shell. No worker/license/spend/provider/share/scope changes.

## QA/integration
- New npm run test:report-browser-preflight:9 checks, including16 real registry
entries in preflight-only mode and six invalid-input cases.
- Real harness mapping mutation to WRONG_PORT rejects before any PASS case;
restored fast suite9/0. Temporary mutation removed.
- Real occupied-port reports refresh/locale-search6 checks, QA unknown/clear6
checks pass,12 total in bounded subsets. Full16-case startup harness not rerun.
- Docs4 checks138routes, syntax/diff pass. No app build/full-web/unit/backend/
real-browser product success/native/sync/provider acceptance rerun claimed.
Coverage22FULL/7PARTIAL/1MISSING, workers defaultOFF and external gaps unchanged.
Five review perspectives complete, no remaining scoped issue before commit.
