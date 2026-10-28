# Review 0015 - Glossary with in-editor term hints

## Scope
GlossaryTerm model (term unique per project case-insensitively, notes, doNotTranslate,
per-locale translations validated against project locales), CRUD API, glossary page,
editor hint chips under base-locale cells for keys whose source text mentions a term,
activity-log actions (glossary.created/updated/deleted).

## Pass 1 - Developer
- api + web builds green. scripts/glossary-test.mjs: 13/13 after fixing one assertion
  that assumed case-insensitive DB ordering; Postgres codepoint order puts
  'Open-locale' before 'checkout', assertion now checks deterministic sortedness.
- Editor hint regex escapes term metacharacters and requires non-word boundaries.

## Pass 2 - Product
- Terms unique per project, case-insensitive (service-level check, 409 on conflict).
- Translations restricted to project locales; unknown locale keys rejected.
- Found and fixed during review: hint showed '(no translation)' whenever the
  import/export locale selector equaled the base locale, even with a translation
  available in another visible column. Target now falls back to the first non-base
  locale; chips show the real translation.
- doNotTranslate terms render as 'keep as-is' instead of a translation.

## Pass 3 - Designer
- editor-18-glossary.png inspected: hint chips 'glossary: Welcome -> ברוכים'
  visible under both matching EN cells, lavender pill style consistent with tag chips,
  header Glossary link in place. Earlier run showed the hints missing entirely
  (template insertion had silently no-oped); caught by visual inspection, fixed, re-verified.

## Pass 4 - Security
- All glossary endpoints behind project membership (JWT or API token), same guard as tasks/TM.
- translations JSON validated: only known project locales, string values, size bounded by DTO.
- No raw token/password material in activity entries (term text + notes only).
- Case-insensitive uniqueness enforced in the service; a DB-level unique index on
  lower(term) is tracked as a hardening item for a follow-up migration.

## Pass 5 - QA / integration
- scripts/glossary-test.mjs 13/13 (create, duplicate 409, list order, update,
  translations validation, delete, cross-project isolation).
- e2e-visual 35/35: glossary term created through the UI, per-locale translation
  typed on the glossary page, hint chip asserted in the editor, screenshot taken.
- No regressions in suites exercised this session (e2e covers auth, keys, editor,
  statuses, tags, comments, activity, imports, screenshots, tasks, TM flows).
  Full standalone suite loop deferred to next feature run; tags flake watch continues.

## Known gaps
- No DB-level unique index on lower(term) yet (service check only).
- Hints match whole terms only; no stemming/plural handling.
