# 0102 - GitHub contents transport groundwork

Source checked: https://docs.github.com/en/rest/repos/contents
The read endpoint uses explicit ref; the update endpoint requires current
blob SHA for replacement and returns 409 on conflict. API version header
2026-03-10 follows the inspected current documentation.

## Developer pass
Add isolated GitHubContentsClient, not wired to any controller or worker.
Read/update only existing single files; no create/delete, no automatic retry.
Validate repository/path/branch, decode bounded strict base64 and UTF-8,
check response path/size and Git blob SHA. Malformed results fail explicitly.
Writes require expected SHA, explicit branch, bounded text and commit message.
A malformed success response states remote outcome needs reconciliation.

## Product pass
This is transport groundwork toward two-way sync, NOT usable integration.
Connection persistence, App installation/token exchange, project authorization,
import/export mapping, preview/conflict flow, sync journal and UI remain open.
Real provider acceptance remains unverified. Do not promote the GitHub
coverage row based on an unconnected class. No real registration or token
scope expansion needed for this local fixture work.

## Designer pass
No UI surface in this slice; future connection/preview/conflict pages need
explicit repository, branch, path and project-locale mapping.

## Security pass
Fixed https://api.github.com production origin; only NODE_ENV=test permits
literal 127.0.0.1 HTTP fixture origin. Credentials rejected if containing
controls/whitespace; supplied explicitly by future authorized caller, never
read from dev push credential or a global token env. Reuse pinned connector
with bounded response, DNS validation, TLS identity and redirect rejection.
Never follow provider download_url, which could send auth outside origin.
Symlink/submodule/directory payloads refused. Provider error bodies suppressed.
Blob SHA verifies content consistency, not independent provider authenticity.
No repository write occurred during development; all writes are local HTTP
fixtures. This class does not establish permission for future remote writes.

## QA/integration pass
16 new API tests (155 -> 171; 21 -> 22 suites), PASS RC=0, using real HTTP
server sockets, not a mocked request function. Explicit ref/auth/version,
update body/SHA/return fields, conflict no retry, redirect no follow,
six unsafe paths rejected before network, unsupported file shapes,
invalid encoding/size/UTF8, missing expected SHA, sanitized errors,
fixed-origin check, mismatched Git blob SHA. Added SHA consistency during
review before commit; both targeted unit runs passed (170 then 171).
API build RC=0. No interim failing runs. Existing UI unchanged. Full sweep
at final HEAD before push; no new separate suite leg needed because adapter
transport tests run within API unit leg.
