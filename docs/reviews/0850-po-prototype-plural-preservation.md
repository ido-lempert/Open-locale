# PO exact prototype-named plural preservation

## Developer
PO parser builds plain entries from rows, then adds plural entries by key.
Both entries and plural metadata dictionaries need null prototypes: normal
entries assignment silently loses __proto__ value; normal forms map loses
explicit metadata. Initialize both maps without prototypes; keep CLDR mapping
and existing parser subset unchanged. No key-name ban or schema change.

## Product
Exact __proto__ msgid imports as plural with one/other values, exports both
msgstr slots, and reimport counts unchanged without losing forms. Neighboring
plain constructor remains nonplural. No broader PO support claim.

## Designer
Backend/file-data fix only, no UI/screenshot inspection claim.

## Security
Treat valid names as own data rather than invoking prototype setter behavior.
No global pollution/external attack claim. No auth/provider/worker/license,
spending/sharing/credential-scope change. Local fixtures only.

## QA/integration
Initial fixture had malformed header escaping; corrected before valid baseline.
Valid baseline4 new failures. Null-prototype forms-map-only attempt still
failed4 because entries assignment also dropped value. Final actual formats
suite226 checks =222 prior+4 new pass. API build, syntax/diff/docs pass.
Diagnostic removed. No browser/whole-web/native/provider rerun claim.
Existing22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
review perspectives completed before commit; no scoped findings remain.
