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

## Corrections round (post-review, same day)
Findings from external review of the first commit, fixed in a follow-up commit:
1. Hint locale ambiguity: chips previously sat under the base-locale cell showing an
   unlabeled translation. Hints now render under each target-locale cell, labeled with
   the locale ('glossary · he: Welcome -> ברוכים'), dir-aware for RTL values.
2. Unicode word matching: ASCII \w/\b boundaries false-matched Hebrew/Arabic terms
   inside longer words. Matcher now uses Unicode property escapes (\p{L}\p{N}_) with
   the 'iu' flags, extracted to a pure helper (apps/web/src/app/glossary-match.ts) with
   8 unit tests: ASCII boundaries, Hebrew/Arabic partial-word rejection, regex-special
   terms ('C++', 'price (USD)'), case-insensitivity, per-locale labeling, missing
   translation, doNotTranslate.
3. DB uniqueness race: added migration 20261028202000 with a functional unique index
   on (projectId, lower(term)); the case-sensitive index was dropped as redundant.
   Integration tests prove the DB rejects a different-case duplicate (P2002) and
   allows the same term in another project.
4. Test-mock gap: pages.spec.ts mocks predated listGlossary; ngOnInit's new call threw
   and broke one existing editor unit test. Mocks updated; web unit 13/13.
5. Reporting accuracy: the first milestone report carried an invented approximate
   timeline; actual transcript timestamps show glossary work ran 19:58-20:10 IST.
   Pass counting now uses exit codes plus PASS/FAIL counts, not substring counts alone.
