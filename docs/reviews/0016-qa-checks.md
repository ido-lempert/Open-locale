# Review 0016 - QA checks

## Scope
Automated QA checks over project translations: untranslated (non-empty base, empty
target), placeholder mismatch ({var} and printf %s/%d/%f token multisets compared
between base and target), maxLength exceeded. GET /projects/:id/qa?locale=he computes
on the fly; QA page lists issues with key, locale, type badge and detail, with a locale
filter; linked from the editor header.

## Pass 1 - Developer
- api + web builds green. scripts/qa-test.mjs 9/9: per-locale untranslated flags,
  placeholder mismatch isolated to the broken locale, maxLength isolated likewise,
  clean key and empty-base key produce nothing, locale filter, non-project locale
  empty, cross-team 404, mismatch detail lists both token sets.
- Boot-order bug caught by the suite: QaModule initially missed AuthModule/ProjectsModule
  imports, API refused to start; the test's own health check caught it.

## Pass 2 - Product
- Empty base source is not flagged untranslated (nothing to translate from).
- An untranslated cell reports only 'untranslated', not stacked mismatch findings.
- Detail strings name the concrete placeholder sets on both sides.
- Read-only API tokens can run QA (GET only), mutations unaffected.

## Pass 3 - Designer
- editor-19-qa.png inspected: table readable, issue-type badges color-coded
  (neutral untranslated, red placeholder mismatch, amber too-long), muted detail text,
  locale filter in toolbar, back link to editor. No secrets in frame.

## Pass 4 - Security
- Endpoint behind the same project-membership guard via ProjectsService.getFor
  (team-scoped, 404 on cross-team, no data leakage about project existence).
- No writes at all; no new activity-log surface; placeholders are computed in memory
  from translation text already readable by members. Regex has no user-controlled
  pattern (fixed token families), so no ReDoS surface from input.

## Pass 5 - QA / integration
- Full strict regression: 12 suites exit 0 / 0 FAIL (phase0 7, authz 28, statuses 14,
  tags 9, comments 18, activity 24, imports 15, screenshots 18, tasks 15, tm 12,
  glossary 15, qa 9), api unit 5/5, web unit 13/13, e2e-visual 37/37 exit 0 including
  creating a mismatched key through the UI and finding it on the QA page.
- Tags flake did not recur in this loop (3 consecutive green full loops now).

## Known gaps
- Placeholder families limited to {var} and printf %s/%d/%f; no ICU plural/select
  structure validation yet.
- No per-cell inline indicators in the editor grid; findings live on the QA page.
- maxLength is enforced as a check, not at write time.

## Correction (same day)
External visual review caught that the QA badge rendered as plain text. Root cause:
this session's style blocks (glossary hints, do-not-translate badge, QA badges) were
appended to apps/web/src/styles.css, but the app's global stylesheet is styles.scss -
styles.css was never loaded. Side effect: glossary hint chips in editor-18 previously
showed only the generic <code> background, not the claimed lavender pill; the earlier
'lavender pill' description in review 0015's designer pass was wrong about what the
pixels showed. Styles moved into styles.scss, styles.css deleted, e2e rerun 37/37,
both screenshots re-inspected: QA badge renders as red pill, glossary chips render as
lavender pills. Lesson recorded: verify stylesheet identity before claiming styling.
