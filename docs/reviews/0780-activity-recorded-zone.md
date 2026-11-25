# Explicit activity recorded time

## Developer
Medium time with displayed zone replaces ambiguous short timestamp. Valid source
gets exact datetime attribute; malformed input keeps fixed fallback with no
attribute. Existing sort/download untouched. No timestamp normalization.

## Product
Seconds distinguish nearby recorded actions; explicit zone avoids ambiguity.
Recorded activity remains a journal, not confirmation of current state or action
success. Raw source instants and loaded-order downloads unchanged.

## Designer
Inspected actual full desktop and390px mobile pixels. Medium date/seconds/zone
and unavailable labels readable. Longer timestamps wrap onto separate line on
mobile without overflow; action/key rows remain intact. Mobile is scrolled to
rows with sticky filter header, no earlier-scope visual acceptance claim.

## Security
Invalid raw timestamp never placed in datetime or rendered as label. No provider,
registration, token scope, spend, worker, sharing or license changes. Download
allowlist and private metadata scope unchanged.

## QA and integration
- New unit verifies locale medium+zone, equivalent UTC/offset instant and distinct
 seconds. Old short label negative1 fail/0 pass. Fixed restored.
- Affected activity6 suites/95 tests pass; old formatting expectation updated for
 intentional medium+zone display. No full-web rerun claim.
- Actual browser7/0: equivalent instants/distinct seconds, exact datetime with
 invalid omission,390px fit, stable second-level order, raw loaded download,
 one read/no mutation, no runtime errors. Disposable API/PostgreSQL with
 intercepted activity GET fixture.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No whole-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
 1 MISSING and external acceptance gaps unchanged.

Five review passes complete; old formatting assertion updated.
