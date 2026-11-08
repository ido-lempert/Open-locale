# 0464 Explain local new-project form state

## Developer review
Computed draft presence uses raw name/slug/locales, including whitespace, separate
from project rows, filters and two-factor fields. Pending creation takes priority
over unknown creation. Existing exact submitted-form comparison clears unchanged
form on success, preserves newer edits. No request/storage/navigation/reset/API
change; security state and independent project/status reads unchanged.

## Product review
Normal local form denies automatic save/restoration and suggests copying before
leaving. Pending creation distinguishes editable current form from submitted data,
with no repeat. Unconfirmed creation stays unconfirmed/check-refresh-before-create,
not an unsaved-server claim. A confirmed create plus failed list read retains
receipt and newer local draft without turning success into uncertainty.

## Design review
Desktop and390px screenshots inspected: project-form guidance above inputs,
independent two-factor panel below, readable without horizontal overflow. Existing
form/header wrapping retained. No CSS or pixel correction needed. Feedback clears
when raw form emptied and never represents the separate security input as a draft.

## Security review
Read-only computed presentation uses no HTML interpretation or new side effects.
Passwords/codes/setup secrets/recovery codes are not read by draft computation or
included in guidance. No new backup/export. Existing pending/unknown create guards
unchanged. No dependency/license/spend/registration/worker/credential-scope change.

## QA/integration review
Unit5/web972 in94 suites/API265 in31/builds0 (unchanged API cached). New browser13/0
covers security-input independence, zero typing effects, actual held POST/current
versus submitted/newer form/confirmed receipt with failed read, real committed then
dropped response, failed/current recovery, unchanged success clearing, locale-only
input and clearing raw form. All API groups and91 isolated browsers final0.
QA-search initial preassertion PostgreSQL55722 bind abort0PASS, delayed unchanged
retry10/0; no assertion failure or app/test fix. Separate sync95+144=239unique;
native116+111+19=246total242unique/four startup repeats all inner/outer0. Config16/14/
docs4-138routes/reaper4 all0. Completed results preserved across continuation;
explicitly staged/no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF
unchanged.
