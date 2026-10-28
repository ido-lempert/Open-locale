# Review 0009 - Comments per key with locale scoping

Scope: Comment model (migration 20261028172000), list/add/delete endpoints with
locale scoping, author-only delete, comment counts in the key list, editor comments
panel (list, add with locale scope, delete), count badge on the toggle.

## Pass 1 - Developer
- Comment rows carry keyId, authorId, optional localeCode (null = all languages) and
  a 2000-char body cap (400 over that). Locale scope validated against the project's
  locales (404 on unknown locale).
- Locale filter semantics: filtering by a locale returns that locale's comments plus
  global ones - a translator working in Hebrew sees Hebrew notes and shared notes.
- Finding: the key list's comment count include was added to the service but the
  running build was stale, so the UI badge never updated. Found by the e2e count
  check, fixed by rebuilding; the e2e now asserts the badge end to end.

## Pass 2 - Product manager
- One click on "comments" in the key cell opens the thread inline, same pattern as
  history. The toggle shows the count so discussion is discoverable from the grid.
- Scope selector defaults to "all languages" so casual notes are shared; scoping to
  one locale is one extra click.
- Deferred and recorded: @mentions (needs notifications to be useful, Phase 2), and
  comment editing (delete + repost covers the realistic case for now).

## Pass 3 - Designer
- Panel matches the history panel's visual language (scope chip, body, author, time,
  delete). Screenshot editor-13 inspected: count badge, scope chip and form render
  cleanly; the form spans the panel width with the scope select and Post button
  trailing. No overlap with the grid on narrow widths (form wraps).

## Pass 4 - Security researcher
- Cross-team comment read and delete return 404, not 403 - no existence leak
  (proven in comments-test).
- Delete is author-only at the service layer, proven end to end: a same-team
  member (joined via test fixture, since invitations UI is not shipped) can read
  and comment but gets 403 deleting another author's comment, and the comment is
  unchanged afterwards; the same member deletes their own comment fine.
- Read-only API tokens (X-Api-Key) read comments (200) but mutations are denied
  (403), proven against the comments endpoints.
- Bodies are length-capped and stored as plain text; rendering escapes HTML via the
  framework's interpolation (no innerHTML anywhere in the panel).

## Pass 5 - QA / integration
- comments-test.mjs (real PostgreSQL + HTTP): 18/18 - global and locale-scoped
  creation, unfiltered/locale-filtered lists, he-only excluded from en filter,
  author delete, deleted comment gone, 400 over 2000 chars, 404 unknown locale,
  cross-team read/delete denied, same-team different-author delete denied 403 +
  comment unchanged, same-team author delete allowed, read-only token read 200 /
  write 403.
- e2e-visual.mjs 24/24: comment posted through the UI, listed with author and scope,
  count badge updates to (1). Screenshot editor-13 inspected and secret-scanned.
- Web unit 5/5; api unit 5/5; tags 9/9; status/history 14/14; authz 28/28;
  integration 7/7; both builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
