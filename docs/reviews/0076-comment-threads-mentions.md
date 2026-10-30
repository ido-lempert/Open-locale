# 0076 — Comments: one-level reply threads and @email mentions

## Scope
Closes the audited "comments: mentions + threading" partial with a deliberately
narrow model:

- **Threading**: a comment may carry `parentId` pointing at a top-level
  comment on the same key. One level only: the service rejects a reply whose
  parent is itself a reply (400). Replies to comments on another key, to
  deleted comments, or with a malformed id are rejected (404 / 400).
- **Mentions**: `@email` tokens in the body are resolved at create time
  against members of the project's team only. Resolved mentions are stored in
  `comment_mentions` and returned by the list endpoint; unknown tokens,
  non-members, and non-users stay plain text with an identical response shape
  (no membership enumeration through mention probing).

## Data model
- `comments.parentId` (nullable, self-FK, ON DELETE CASCADE): deleting a
  parent removes its replies - a reply without its context would be
  misleading. Only the parent's `comment.deleted` activity is recorded;
  the cascade is a DB-level invariant.
- `comment_mentions` (commentId, userId composite PK, both FKs CASCADE).

## Why resolve at write time
Bodies are immutable (there is no comment editing), so mentions never go
stale; rendering never re-parses or joins more than the stored relation.

## Web
- Comments render as roots with nested reply lists (indented, left border).
- Each root comment has a Reply button; the form shows "Replying to X" with a
  cancel, and submits with `parentId`.
- Bodies render as interpolated text segments - mentions get a styled span,
  but no innerHTML is ever used, so escaping is preserved.
- The comment count badge includes replies (they are comments).

## Boundaries (explicit)
- No mention autocomplete, no notifications, no comment editing, no
  reply-to-reply. Mention syntax is `@email` only, not display names.

## Verification
- comments-test 33 PASS / 0 FAIL / RC=0 (+15 legs: reply create, nested
  reject, deleted-parent reject, malformed id reject, cross-key parent
  reject, member mention resolved, case-insensitive match, non-member plain
  text, unknown token plain text, duplicate stored once, list shape, activity
  detail records mentions, cascade delete).
- e2e-visual 226 PASS / 0 FAIL (+4 legs: mention highlighted, reply mode,
  nested reply, reply author; screenshot editor-51-comment-thread.png
  OCR-verified). One pre-existing leg fixed: the activity action-filter leg
  hard-coded a count of 1 comment row, invalidated by the new legs; it now
  asserts the actual property (every visible row is a comment row).
- Unit api + web green (nx run-many, RC=0); api and web builds clean with
  real exit codes captured.
- Migration 20261030081500 applied via prisma migrate deploy in the test rig.

## Coverage note
Closes one of the ten audited PARTIALs (comments mentions/threading) from the
19 FULL / 10 PARTIAL / 1 MISSING baseline. No other item changes.
