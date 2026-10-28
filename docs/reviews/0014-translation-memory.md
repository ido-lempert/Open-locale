# Review 0014 - Translation memory

Scope: TmEntry model (migration 20261028175500), auto-population on save and
import, GET /projects/:id/tm/suggest with exact + fuzzy matching, editor
suggestions on empty cells with explicit apply.

## Pass 1 - Developer
- Memory is written inside the same transaction as the translation change
  (both upsert and import paths), so it can never drift from committed data.
- Empty targets are never remembered; an emptied translation does NOT erase
  the previous memory (proven). Base-locale saves are their own source and
  are skipped; the source locale identity is stored explicitly
  (sourceLocaleCode) even though Phase 1 always sources from the base locale.
- Matching: Dice bigram similarity in app code, threshold 0.5, top 5.
  pg_trgm indexing is the Phase 2 scale item (recorded).

## Pass 2 - Product manager
- Suggestions appear only where they help: an empty target cell whose
  base-locale source has matches. Applying is an explicit click and routes
  through the normal save path - the cell stays unverified until a human
  reviews it. No silent overwrites, no review-status inheritance.
- Scores shown as percentages so translators can judge match quality.
- Deferred and recorded: team-wide memory sharing across projects,
  concordance search UI, TM import/export (TMX).

## Pass 3 - Designer
- Suggestion buttons sit under the focused cell with the target text and a
  match percentage; RTL text renders right-to-left. Screenshot editor-17
  inspected: suggestion visible under the Hebrew cell with 100% match, the
  English cell shows its saved state.

## Pass 4 - Security researcher
- Memory is project-scoped: a second project in the SAME team sees nothing
  (proven) - tenant isolation is stronger than team-level by design choice.
- Cross-team suggest 404 (proven); read-only API tokens may suggest (200) -
  reading memory is read scope.
- Suggest rejects the base locale (400) - no self-matching noise.

## Pass 5 - QA / integration
- tm-test.mjs (real PostgreSQL + HTTP): 12/12 - base-only save remembers
  nothing, exact match score 1, target update refreshes memory, fuzzy match
  (96%), locales separated, empty target never overwrites, base-locale
  suggest 400, imports feed memory, project isolation, cross-team 404,
  read-only token 200.
- e2e-visual.mjs 33/33: suggestion appears on focus with score, explicit
  apply fills and saves the cell. Screenshot inspected and secret-scanned.
- Full regression: statuses 14/14, imports 15/15, activity 24/24,
  screenshots 18/18, tasks 15/15, comments 18/18, tags 9/9, authz 28/28,
  integration 7/7, unit 5+5, builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
