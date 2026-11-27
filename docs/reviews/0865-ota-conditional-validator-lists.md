# OTA conditional validator lists

## Developer
Replaced exact header-string equality with a small whole-field parser for
GET/HEAD If-None-Match weak comparison. Handles quoted opaque tags, comma
lists, empty list members and a standalone wildcard. Commas inside quotes
remain data. Invalid whole fields never produce a hit. Matcher has no mutable
request state. Controller still resolves bundle before conditional evaluation.

## Product
Existing exact weak validator clients keep working. Clients supplying strong
equivalents or lists can now reuse cached bundles instead of downloading again.
Wildcard applies only to an existing authorized bundle. Payload and identity
unchanged. Semantics source checked: RFC9110 section13.1.2 at
https://www.rfc-editor.org/rfc/rfc9110.html . No broad HTTP compliance claim.

## Designer
Metadata-only change. No visible UI change or new screenshot claim.

## Security
Review found generic trim would accept non-HTTP whitespace and JavaScript end
anchors can admit a final newline. Replaced trim with HTTP SP/HTAB matching
and explicitly reject CR/LF. Whole-field syntax prevents malformed wildcard
lists or trailing garbage from suppressing a response body. Authorization,
publication pinning and scope validation still run first. No secrets, worker,
license, spending, provider or disclosure scope changes.

## QA/integration
Actual PostgreSQL/HTTP baseline failed exactly four new positive cases:
strong equivalent, matching first/last list member, wildcard. Fixed96 checks
pass (82prior+14new), including unknown/malformed/substring/quoted-comma
negative cases, matching304 metadata, private cache policy and wildcard
unauthenticated/missing locale checks. Whole API34 suites318 tests pass,
including28 matcher cases. API build/docs/diff/syntax pass. Two initial Jest
commands used wrong config extensions and were corrected to actual .cts file;
only the successful run supplies the unit result. No browser/whole-web/native/
external provider rerun claim. Latest whole-web797315/3864. Existing acceptance
ledger22FULL/7PARTIAL/1MISSING and defaultOFF unchanged. Five reviews complete
before commit, with scoped findings fixed and rerun.
