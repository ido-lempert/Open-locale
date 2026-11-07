# 0449 Download loaded activity metadata

## Developer review
Explicit JSON projection of current loaded rows, project, action/actor/key filters
and hasMore indicator. Export ready only after a successful current read; pending,
error, initial, debounced-key and destroyed states refuse captured handler too.
Read start resets readiness/notice, including pagination; current generation fences
preserved. Blob URL released after successful/failed click. No API/schema/dependency
change, no extra reads/writes or automatic pagination.

## Product review
Downloads loaded filtered pages, not full history or newer unread events. Includes
metadata only, deliberately not the full detail visible in the feed. hasMore tells
whether older pages remain, not completeness certification. Current actor ID may
appear in filter scope. File can contain private project metadata; local download
is not sharing, delivery proof or action-outcome proof. Requested is not saved.

## Design review
Actual desktop and390px screenshots inspected: download button, scope and requested
notice wrap without horizontal overflow; filter and feed remain readable. Long
scope description is explicit about excluded detail/private content and pagination.
No app/fixture correction required after visual inspection.

## Security review
Whitelist excludes raw detail, translation/comment bodies, actor emails, automation
messages/errors and unknown API fields. It retains IDs, action, displayed actor
name, key, locale and timestamp; these can still be private. JSON handles quotes,
newlines and markup literally. No spreadsheet/HTML execution format, no external
upload/share or worker/account changes. Owner upload evidence inspected as exact
original WhatsApp channel history with service, verified handle, conversation and
message IDs after provenance warning; no conflicting source identity/scope found.

## QA/integration review
Unit8/web855 in79 suites/API265 in31/builds0. New real browser11/0 first run:
actual file bytes exactly match first50/hasMore, appended55/no newer unread,
filtered11/current scope; held/error/departed guards, empty new project, bounded
local failure, zero mutation requests. Raw detail and actor email excluded despite
API returning them. All API/76 isolated browsers final0, no failed/interrupted
checks. Sync separate95+144=239unique and native116+111+19=246total242unique/four
startup repeats, inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Continued
runs preserve completed checks; no canonical uninterrupted claim. Coverage
22FULL7PARTIAL1MISSING/defaultOFF unchanged.
