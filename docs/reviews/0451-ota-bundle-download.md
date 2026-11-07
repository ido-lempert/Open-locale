# 0451 Download loaded retained OTA locale bundle

## Developer review
Explicit context/payload projection includes all loaded retained locale values,
independent of local page/search. Publication ID stays explicit null for legacy
unpinned links. Initial, pending read, failed read, absent bundle and destroyed
handler guards prevent stale export; reread clears feedback/readiness. Temporary
Blob URL released even after click failure. No API/schema/dependency change.
Corrected copied browser harness labels/database/temp names to OTA scope; the
unchanged application passed its dedicated browser again after that test cleanup.

## Product review
Local review aid includes private translation content and publication context,
including empty/unreviewed values. It is not live editor content, a new publication,
sharing, saved-file confirmation or proof of client delivery. No automatic reads,
writes or new audience. Legacy links do not gain pin authority from the file.

## Design review
Actual desktop and 390px pixels inspected after final dedicated browser run:
button, private-content scope, pin identity and requested notice are readable
without horizontal overflow. Existing local search remains independent of file
scope. No visual correction required.

## Security review
Explicit whitelist excludes unknown bundle fields. Literal quotes, newlines and
markup remain JSON strings. No API mutation during download, no external services,
worker enablement, account, spend or credential-scope change. Owner upload request
and current repository/remote state checked separately before push.

## QA/integration review
New unit8/web873 in81 suites/API265 in31/builds0. Real browser9/0 first run and
again after harness-name cleanup: exact51 retained translations off-page/under
search, literal/empty content, excludes later unread live edit, pinned ID/legacy
null, held/failed read, bounded local failure and departed handler/zero mutations.
All API/78 isolated browser suites final0. Merge-concurrency and editor-import-
drafts each initially aborted on PostgreSQL bind before assertions, unchanged
retries7/0 and5/0. Separate sync95+144=239unique/native116+111+19=246total,
242unique/four startup repeats, inner/outer0. Config16/14/docs4-138routes/reaper4
all0. Completed checks preserved across continuation; no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
