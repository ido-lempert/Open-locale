# Review 0078 - MT pre-translate provider scoring with provenance (slice 14)

## Scope (bounded)
Adds a confidence-score hook to the internal MT driver interface and implements it
for the built-in pseudo driver only. The pseudo score measures STRUCTURAL
PRESERVATION (PRESERVE-token round-trip: 100 minus 20 per missing/extra token,
floor 0). It is plumbing-fixture evidence, NOT linguistic quality, and every
surface that shows it says so. No external MT provider, credential, or network
call was added: the AI/MT coverage item stays PARTIAL under the external
provider gate.

## What changed
- Schema: Translation gains mtScore Int? + mtProvider String? (migration
  20261030091500_translation_mt_provenance). Both are provenance fields: set
  ONLY by pre-translate fill, cleared by human edit / import / snapshot
  restore, carried by branch merge.
- mt.providers.ts: MtDriver gains optional score(source, translated): number|null.
  Pseudo driver implements pseudoScore (structural, documented as fixture).
- mt.service.ts pretranslate: per-pair scores computed, written on INSERT and on
  ON CONFLICT DO UPDATE; aggregates computed over WRITTEN rows only and returned
  as scored/scoreAvg/scoreMin/scoreMax (null when the driver scores nothing).
  Activity detail gains the score summary.
- Provenance invariants (each test-verified): human PUT clears, import upsert
  clears, snapshot restore clears, branch merge (both cutoff forms) carries.
- Web: Translation/CellState/MtPretranslateResult carry the fields; editor shows
  an .mt-badge "MT <score>" on MT-filled cells (cleared locally on save, mirroring
  the server); settings result line shows avg/min/max with the structural-only
  disclaimer.

## Verification (this HEAD)
- scripts/mt-test.mjs: 42 PASS / 0 FAIL / RC=0 (was 35; +7 score/provenance legs:
  exact aggregates, provenance on filled rows, untouched row stays null, activity
  detail scoreAvg, human-edit-clears via dedicated key a.provclear + own provider
  Pseudo-2 so no other leg's counts shift).
- Unit api: 132/132, 18/18 suites, RC=0 (was 128/17; +4 cases in new
  mt.providers.spec.ts: 100 on preserved, -20 per missing token, floor 0,
  empty-token 100).
- e2e-visual: 234 PASS / 0 FAIL / E2E_RC=0 (was 231; +3 legs: result line shows
  avg 100/min 100/max 100, editor .mt-badge visible, badge text "MT 100").
- Builds: api clean (API_RC=0), web clean (WEB_RC=0).
- Screenshot editor-53-mt-score.png pixel-inspected (OCR): "MT 100" badge visible
  in-frame on pseudo-filled rows.

## Defects caught by verification this slice
1. branches.service.ts merge INSERT (both cutoff forms): closing quote typo
   (EXCLUDED."mtProvider') - SQL syntax error -> 500 on merge, caught by the
   e2e merge leg. Production defect in new code, caught pre-commit by test.
   Fixed and re-verified (full e2e re-run, 234 PASS).
2. Interim test-fixture fixes (disclosed, not app defects): mt-test kp block
   initially placed before run2 shifting exact counts (moved to suite end);
   shared provider deleted by an earlier leg (dedicated Pseudo-2);
   mt.providers.spec.ts initially called translate without the required config
   argument.

## Boundaries kept
- No external provider, no credentials, no network MT calls.
- No compatibility/parity claims; score semantics documented as structural-only.
- AI/MT coverage item remains PARTIAL (external provider gate) - this slice adds
  the scoring surface named by the plan bullet, not production MT quality.
