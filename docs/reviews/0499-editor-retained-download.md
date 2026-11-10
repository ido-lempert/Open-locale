# 0499 Local retained-grid backup download

## Developer review
The download reuses retainedGridValues, so its values match the existing copy
textarea, including plural forms. The envelope names schema version, project,
unverified current-grid scope, confirmedSaved false and importFile false. The
handler refuses healthy/loading/empty/missing-project/departed state. It never
calls an API, reload, save or retry. Blob URL is revoked even if anchor click
throws. Fixed error text keeps private exception details out of the notice.

## Product review
A paused editor now offers a local backup before replacing the retained grid.
This is recovery assistance, not a server snapshot, complete project export or
import file. Explicit scope and privacy copy remain adjacent to the button. A
requested download is not proof the browser saved it; users must check the file.
No import compatibility or automatic restore claim.

## Design review
Actual desktop and390px screenshots inspected: button, current-grid/privacy
scope and download notice readable outside the inert grid. Existing selectable
JSON fallback remains. The fixed filename contains no user/key content.

## Security review
Local-only Blob download, no upload/sharing/remote endpoint. Data intentionally
contains the currently retained translation text; visible privacy warning says
so. JSON serialization, fixed filename and fixed notices avoid interpreting
key/value text as markup or paths. No worker, credential, dependency, license,
authentication or permission change. Existing editor mutation boundaries remain.

## QA/integration review
New8 units/web1314 in127/API265 in31 and builds0 (API cached). Focused actual
browser8/0: real failed save plus another local draft, actual parsed downloaded
JSON including plural text, explicit envelope/scope, zero API requests, retained
values, URL revocation,390px control and pending captured-call refusal/runtime.
Old app discriminator2PASS then expected missing-download-control abort; full
log retained. All API/transport batches0 first attempts. Separate sync95+144=
239 unique/native116+111+19=246 total242 unique/four repeated startup checks,
each stage inner/outer0 first attempt. Config16/14/docs4/reaper4 all0. All126 isolated browsers first-attempt0, no post-fix failures or aborts.
Completed checks preserved across continuations; staged, not uninterrupted. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
