# Branch paired-read export regression

## Developer
Two unit cases settle older branch success/failure while current paired read
is pending. Completing current progress alone does not enable download;
current quality must also complete. Browser releases current main pair first,
then old release progress success and quality503. No app change needed.

## Product
Actual file after late old responses remains byte-identical current main
payload. Both progress and quality belong to main; branch feedback unchanged.
Branch export remains separate from project usage/task dashboards.

## Designer
No layout/copy change. Existing download scope/feedback assertions rerun.
No new screenshot, saved-file UX or changed-pixels claim.

## Security
Late old503 body cannot become current failure guidance or exported report.
Negative mixed-branch quality mutation is detected, then restored. No worker,
external provider, license, spend, sharing or credential-scope changes.

## QA/integration
Reports7 suites98 tests pass. Branch-download browser12PASS/0FAIL final.
Initial browser6PASS then timeout: network-idle awaited while three requests
were intentionally held. Replaced that wait with exact current-progress
response completion, retaining other requests held. Corrected12/0.
Docs4 checks138routes, syntax/diff pass. Five perspectives completed before
commit. No new build/full-web/all-backend/native/sync/provider acceptance
claim. Coverage22FULL/7PARTIAL/1MISSING, workers defaultOFF and existing
external acceptance unchanged.
