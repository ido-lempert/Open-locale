# SDK integration startup fail-closed

## Developer
SDK real integration suite now defaults exit status to failure and marks
completion only after assertions finish. Exit hook preserves incomplete/failure
status if cleanup await empties event loop. PostgreSQL port has test override.
New occupied-port harness launches real suite with reaping, bounded timeout.

## Product
Prevents an empty aborted verification run appearing successful. No SDK library
or product behavior change, no registry publication.

## Designer
Test-run reporting only, no visible UI or screenshot claim.

## Security
False-green testing is avoided. Harness uses ephemeral local occupied port,
never external accounts/services. No token scope/provider/worker/license/spend/
sharing changes.

## QA/integration
Baseline occupied-port probe printed startup abort and zero assertions but
exited0. Exactly one harness assertion failed. Fixed harness3 checks pass:
real abort, nonzero without timeout/signal, zero application PASS. Real normal
SDK66/fast URL58/OTA117 green. Syntax/diff/docs pass. No build/unit/browser/
native/provider rerun claim. Latest807 API34/318,804 OTA browsers85, whole-web
797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
perspectives complete before commit, no scoped findings remain.
