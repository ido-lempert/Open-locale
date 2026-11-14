# Explicit group name Save

## Developer review
Existing name-only updateGroup PATCH, trimmed snapshot. Local raw per-group draft,
clear only unchanged raw text, preserve newer input, accepted local name before
reload so refresh failure permits explicit newer revert. Same-group name/role/
scope pending guards both ways through PATCH/reload. Other group drafts untouched.

## Product review
Group name previously display-only; explicit Save name avoids replacing a group
just to rename it. Group ID/member grants/membership/task assignment preserved.
Nonempty trimmed name up to100 API-count characters. Duplicate-name server409
keeps draft and no saved claim. Team-wide effect stated, no automatic save or
second PATCH. Existing canManageGroup/server rank rule unchanged.

## Design review
Labeled group name, explicit Save name/saving state, help and visible invalid
correction, full text retained. Actual desktop1278x899/mobile390x844 pixels
inspected after first focused run: saved Renamed translators heading, newer name
input distinct, Save/help/full receipt readable without horizontal overflow.
Mobile saved heading above viewport; direct scope below remains independent.

## Security review
No backend/auth/default/worker change, UI not authority. Fixed name receipt uses
text interpolation. Trimmed name cannot be blank, code-point count no truncation.
Only disposable local demo group renamed. Actual PG name-only request preserves
grant/membership/task assignment; real409 duplicate name and injected403/503
separate refusal from accepted rename with failed refresh. No external request,
actual account grant/credential change, registration, spend or license choice.

## QA review
17 new unit cases first web actual/API cachedRC0, build web actual/API cachedRC0.
First focused13PASS0FAILRC0. Isolated auto-save-on-typing substitution3PASS2FAILRC1
at no-PATCH-on-typing boundary, restored13/0RC0, not full old HEAD. RealPG/browser
checks: invalid blank/over100 code points retained/unsent, noPATCH/GET on typing,
trimmed name-only snapshot, duplicate/role/scope pending guards, newer raw draft
retained, accurate receipt, grants/membership/task assignment unchanged, second
explicit Save, real409 no receipt/refresh,403 no saved claim,503 accepted name+
newer revert enabled, runtime zero errors. Broad: all193 browser suites first2226PASS/0FAIL/RC0, each in own call.
API a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239 firstRC0, checkpoint cleaned. Native first two attempts on55680
failed PostgreSQL bind before app startup/assertions, zeroPASS/outerRC1, incomplete
with2FAILURES; current /proc TCP checks found no listener/row, nothing killed.
Only test PG port switched to55968; unchanged app/fixture fresh stages116+111+19
=246RC0, checkpoint cleaned, not first-pass or uninterrupted. Config16/14/docs4/
glossary harness3/reaper4 firstRC0. Final units/build both cachedRC0. Latest
desktop/mobile pixels re-inspected after broad run: saved heading/newer input
separate, Save/help/full receipt readable, no overflow; mobile heading above view.
Final docs4/diff/node checksRC0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance gaps unchanged.
