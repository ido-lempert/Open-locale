# Review 0004 - Project settings screen + accessibility and autosave hardening

Scope: /projects/:id/settings (rename, description, locale management with base-locale
guard, confirm-gated project deletion), accessibility labels, autosave failure recovery,
mobile editor labels. Reviewer feedback incorporated: label placeholder-only controls,
label the icon-only delete button, confirmation safeguards, failed-save recovery,
verify mobile layout from real narrow-viewport screenshots.

## Pass 1 - Developer
- Settings uses the existing PATCH/DELETE project + locale endpoints; no API change.
- Autosave retry: a failed cell shows "save failed - retry"; the retry forces a re-send
  (value may equal the last known-saved value if the server never received it) and is
  guarded against double-submission while a save is in flight.

## Pass 2 - Product manager
- Delete requires an explicit second step naming the project; no undo is claimed.
- Base locale shows a "base" tag and has no Remove control (API also rejects with 403).
- The earlier deferral "project settings screen" is now delivered; remaining deferral:
  API token management UI (Phase 1/2 per PLAN).

## Pass 3 - Designer
- Finding from 390px inspection: stacked mobile editor cells lost their locale context
  (three unlabeled textareas per key). Fixed: locale code label above each cell on
  narrow viewports only. Re-inspected: EN/HE/AR labels render correctly, RTL intact.
- Settings grouped into General / Locales / Danger zone panels; danger zone visually
  separated with a red-tinted border.

## Pass 4 - Security researcher
- Delete is confirm-gated in UI and authorization-enforced server-side (0002 proofs:
  cross-team DELETE -> 404). No new secrets or endpoints. Confirm step cannot be
  bypassed by accident; it is one click plus one explicit confirmation click.

## Pass 5 - QA / integration
- e2e-visual.mjs extended to 14 checks, all PASS on the real stack: settings rename,
  locale add via settings, base locale has no Remove control, editor grid gains the new
  locale column, mobile (390x844) screenshots of editor and projects captured and
  visually inspected. Chronology honesty: two test-driver flaws were found and fixed
  during this pass (textContent does not include input values; triple-click did not
  select input text in headless Chrome, replaced with explicit clear). One app-level
  race (programmatic input clear vs immediate typing) is handled by the driver
  explicitly clearing; a human cannot type inside the sub-50ms window.
- Builds green; web unit 3/3; API unit 5/5; integration 7/7; authz 19/19.

All findings fixed. Clean rerun achieved.
