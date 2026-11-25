# Bounded file-sync direction display

## Developer
Exact four-case direction switch replaces prototype-bearing object indexing.
Unknown strings remain literal, other values use fixed unavailable label; no
coercion. No preview lifecycle, decision kind, selection or draft logic change.

## Product
Known No change/Local to remote/Remote to local/Manual review labels unchanged.
Unavailable direction does not imply accepted or applied change. Preview still
unverified; conflicting rows all require explicit choices. Server validation
continues to own resolution validity. No automatic draft or mutation added.

## Designer
Inspected full desktop and390px mobile previews plus focused horizontal-scroll
mobile pixels. Direction labels readable, unknown strings literal. Comparison
retains its documented internal scroll; draft selectors are clipped in focused
direction view by design and accessible through horizontal scroll. No unrelated
layout change. Full narrow screenshot alone did not show direction column, so
added targeted screenshot/assertion rather than claiming unseen acceptance.

## Security
Exact matching cannot accidentally render inherited functions/objects. Inert
markup string verified through actual browser interpolation. Malformed values
are not coerced, including object with throwing toString in units. This is
bounded display hardening, not exploit/remediation or broadened execution claim.
No providers, registration, token scope, spend, workers, sharing or license changes.

## QA and integration
-19 new units: four known, eight unknown strings, six malformed and non-coercion/
 preview-choice-draft identity preservation.
- Negative old implementation12 fail/7 pass, fixed restored.
- Full web302 suites/3724 tests green in two bounded stages136/1809 +166/1915.
- Actual browser9/0 with fixture preview response, real local auth/project/API/PG:
 exact labels, inert markup, explicit choices, warnings/no apply,390px internal
 scroll, visible direction bounds, no implicit choices, edit invalidation,
 no runtime errors; only one intercepted preview and no other mutations.
- Focused mobile check first failed due to scrolling to far-right selectors;
 corrected test scroll to direction column and reran all9 green. No app change
 required. Screenshots inspected after final rerun.
- Production web/API build, docs4/138routes, syntax/diff pass.
- No whole-product browser/native/sync/provider rerun claim. Coverage22 FULL/
 7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete, fixture and visual acceptance corrections applied.
