# Review 0079 - MT provenance hardening (slice 15)

## Why
Parent review of slice 14 raised three defects in interpretation honesty:
1. The editor badge "MT 100" alone could read as translation quality.
2. Plural keys got a scalar pseudo fill + a 100 score while their plural forms
   stayed empty - the score implied completeness it could not cover.
3. Provenance clearing was unconditional: a status-only or metadata edit wiped
   it, so the fields no longer tracked the TEXT they describe.

## Fixes (each test-verified)
1. Badge now reads "MT <score> (structure)" with aria-label + title carrying the
   structural-only disclaimer - interpretation unambiguous without hover.
2. Pre-translate SKIPS plural keys (skippedPlural in response, activity detail,
   and the settings result line). The pseudo fixture is scalar-only; filling
   just the scalar cell left empty forms next to a score. Scores now only ever
   sit on actual scalar text the fixture wrote.
3. Provenance clearing is conditional on actual content change:
   - editor upsert: clears only when value or pluralForms change; identical
     resaves and status-only edits preserve.
   - import upsert: same conditional (imported wording wins only when it
     actually differs).
   - snapshot restore: a restore changing only status preserves; a restore
     changing text/forms clears (snapshots do not record MT provenance, so a
     restored text's origin is unknown - claiming MT would mislead).
   - setStatus never touched provenance (verified by test).

## Verification (this HEAD)
- mt-test: 55 PASS / 0 FAIL / RC=0 (was 42; +13: dedicated-fixture fill,
  provenance present, status-only preserve, identical-resave preserve,
  status-only snapshot restore preserve, text-changing restore clear, plural
  skip + skipped row has no value/forms/provenance).
- unit api: 132/132, 18/18 suites, RC=0 (unchanged; no new unit cases).
- e2e-visual: 235 PASS / 0 FAIL / E2E_RC=0 (was 234; +1: result line reports
  plural keys skipped; badge leg now asserts "MT 100 (structure)").
- Fill count in the e2e fixture changed 18 -> 14: the 4 plural keys are now
  skipped instead of half-filled. Expected consequence of fix 2.
- Builds: api RC=0, web RC=0.
- Screenshot editor-53-mt-score.png re-captured and pixel-inspected (2x OCR):
  badge renders "MT 100" + "(structure)" on filled rows.

## Defects caught by verification this slice
- Test-fixture error (not app): my first preserve legs assumed shared fixture
  k1 was still MT-filled, but a pre-existing version-conflict leg had already
  human-edited it (misleading premise, caught by a debug read showing the
  human value). Moved to a dedicated a.provkeep fixture.
- Test-fixture error: k5 identifier collided with an earlier declaration
  (renamed kpl).

## Boundary
Still no external MT provider, no credentials, no network MT calls. The AI/MT
coverage item remains PARTIAL under the external provider gate.
