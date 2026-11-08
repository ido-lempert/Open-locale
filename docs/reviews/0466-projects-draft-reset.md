# 0466 Explicit local new-project form discard

## Developer review
Inline confirmation captures exact raw fields and creation uncertainty. Pending,
empty, departed or mismatching handlers refuse. Creation start/departure clears
prompt. Confirm clears only name/slug/locale text and old backup feedback, not
project rows, server receipt, error or security state. No API/storage/navigation.
Independent failed/pending reads and security work do not prevent local discard.

## Product review
Keep preserves text; Discard warns to copy/download first and no local undo.
Unconfirmed creation stays unconfirmed even with an empty form, and cannot replay.
Only explicit current project read resolves uncertainty. No server undo/deletion
or security change claim; newer edits hide obsolete local reset receipt.

## Design review
Initial screenshot showed touching Keep/Discard buttons. Reused spaced toolbar
layout, then inspected updated desktop/390px screenshots: separate action buttons,
readable warning and independent two-factor panel, no document overflow. Security
input empty in shared screenshots. No native modal or focus-triggered autosave.

## Security review
Reset reads only explicit form fields/uncertainty, no security values. Existing
project/security state retained, no remote effects. No new dependency, license,
worker, registration, spend or credential-scope change. Unknown creation guard
survives local reset and failed recovery.

## QA/integration review
Unit10/web989 in96 suites/API265 in31/builds0 (API cached). Dedicated real browser
11/0 twice after fixture wait fix: first6PASS then missing rendered confirmation
abort, corrected explicit enabled/render waits; no app logic fix. Design spacing
change precedes final units/build/browser. Actual held POST blocks discard; real
committed-then-lost response stays unknown after reset, failed/current recovery,
zero reset requests, security/project independence, stale/departure guards.
All API/93 isolated browsers final0. Sync-history initial preassertion PostgreSQL
55692 bind abort0PASS; delayed unchanged retry6/0, no app/test fix. Separate sync
95+144=239unique; native116+111+19=246total242unique/four repeats, all inner/outer0.
Config16/14/docs4-138routes/reaper4 all0. Completed results preserved across continuation; staged/no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
