# SDK OTA requested branch/version validation

## Developer
Pass requested branch/version to OTA parser and compare after digest/shape.
Absent/empty branch follows existing main default; version helper compares
numeric request version. Latest does not constrain moving version. No copied
maps or response metadata changes.

## Product
Digest-valid wrong-branch/version bundles reject rather than reach caller.
Not full identity validation: locale/project/publication response metadata and
304 cached bytes are outside this bounded check. No authenticity claim.

## Designer
SDK error behavior only, no UI/screenshot claim.

## Security
Scope match supplements digest, never replaces transport/auth. Fixed error
message contains no response text. No token/provider/worker/license/spend/share/
registry changes.

## QA/integration
Baseline first wrong-default-branch assertion fails rejection. Fixed error19
checks (16prior+3new) pass for default/explicit branch and requested version.
Real SDK73 proves valid main/branch/retained versions still work. URL81/redirect
100/startup3/OTA117 green. Syntax/diff/docs pass. No build/unit/browser/native/
provider rerun claim. Latest817 API34/318/formats269,804 OTA browsers85, whole-web
797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
perspectives complete before commit, no scoped findings remain.
