# Review 0010 - Project activity log

Scope: ActivityEvent model (migration 20261028173000), global ActivityService,
audited writes for every mutating endpoint (keys, translations, statuses, tags,
comments, rename, locales, imports), GET /projects/:id/activity with action
filter and cursor pagination, and a web Activity page linked from the editor.

## Pass 1 - Developer
- Every audit write goes through ActivityService.record with the SAME transaction
  client as the mutation it audits: change and audit commit or roll back together.
  Proven at HTTP level: a rejected comment (unknown locale) leaves zero activity
  rows behind.
- keyName is stored as a snapshot, not a foreign key: deleting a key must not
  erase its history from the feed (key.deleted event itself is the proof case).
- detail payloads are small metadata only (truncated values at 200 chars, status
  transitions, tag lists, import counts). No tokens, passwords or request bodies
  are ever logged.
- Import is one summary event per run; per-key lineage stays in
  TranslationHistory with the shared importId (an import is per-key transactions,
  so a single atomic summary is impossible - recorded honestly).

## Pass 2 - Product manager
- The feed answers "who changed what, when" in one place - the most common
  support question on a localization project. Filter by action type for the
  "show me all imports" case; cursor pagination keeps long projects fast.
- Deferred and recorded: per-user filter, date-range filter, and webhook/Slack
  notifications on activity (Phase 2 integrations).

## Pass 3 - Designer
- Feed rows: bold actor, plain-language action verb, key chip, locale badge,
  muted detail line, right-aligned timestamp. Screenshot editor-14 inspected:
  reverse-chronological order, Hebrew values render correctly, empty detail
  spans no longer break the row rhythm (fixed after first inspection).

## Pass 4 - Security researcher
- Cross-team activity reads return 404 (proven). The feed never exposes data
  beyond the project boundary; deleted comments keep only an 80-char excerpt.
- Activity is append-only: no endpoint mutates or deletes events.
- No secrets in detail: audited every record() call site - only actor ids,
  key names, locale codes, truncated translation values, tags and counts.

## Pass 5 - QA / integration
- activity-test.mjs (real PostgreSQL + HTTP): 24/24 - all 11 action types
  recorded with actor, reverse-chronological order, old/new values on edits,
  import counts, action filter, cursor pagination without overlap or reorder,
  failed mutation leaves no audit row, cross-team 404.
- e2e-visual.mjs 26/26: activity page from the editor, feed shows UI-driven
  actions with the actor name, action filter narrows to one row, back
  navigation. Screenshot inspected and secret-scanned.
- Full regression after touching shared services: comments 18/18, tags 9/9,
  status/history 14/14, authz 28/28, integration 7/7, web unit 5/5, api unit
  5/5, both builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
