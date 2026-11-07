# 0454 Glossary local translation feedback

## Developer review
Exact loaded/confirmed translation-map comparison marks current immutable rows,
including empty/missing locale keys, without extra requests. Revert clears it.
Pending/unknown/delete/read/error/departed states use their independent feedback.
Review found comparison left at old server text after edits during pending save;
now advances confirmed comparison only within same list generation while keeping
later local text. Newer read owns comparison; explicit final unit tests that fence.
Existing blur-save request behavior unchanged.

## Product review
Unsaved local text is distinct from saving or unconfirmed server outcome. Guides
users to leave the field to save or copy/download before refresh. It compares
against loaded/confirmed values, not a fresh remote read or complete project-state
claim. No save confirmation without response, automatic new reads/writes or sharing.

## Design review
Actual desktop/390px pixels inspected and sent: local value and row feedback
readable without horizontal overflow. Existing stacked narrow layout preserved.
Feedback appears in Actions area, separate from translation input. No visual fix.

## Security review
Comparison only, no new API/schema or external service. Later local edits are
not overwritten by older confirmation; newer list comparison fenced by sequence.
Unknown outcomes never show unsaved retry guidance. No worker/account/spend/
credential-scope change. Owner upload and live repository validation separate.

## QA/integration review
New unit13/web908 in84 suites/API265 in31/builds0. Browser initially10/0, final11/0
after comparison correction: actual local edit/revert with zero requests, real
pending and confirmed save, later local edit preserved, comparison advances to
confirmed value, unknown feedback distinct, explicit current read. Final added
newer-read fence unit raised web907->908 without production change. All API/81
isolated browser suites0, no failed/interrupted checks. Separate sync95+144=239
unique/native116+111+19=246total/242unique/four startup repeats, inner/outer0.
Config16/14/docs4-138routes/reaper4 all0. Completed checks preserved across
continuation, no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF
unchanged.
