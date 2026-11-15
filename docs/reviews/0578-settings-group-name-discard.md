# Discard local new-group name draft

## Developer review
Clear raw groupName only, including whitespace/overlong text. Busy blocks
button and direct method. No API/reload or group/access mutation. Keep selected
role/locales, other forms and errors. Existing creation receipt becomes accurate
discarded-name wording, none invented.

## Product review
Name-only label/help preserve the intended role and locale grant for the next
explicit Add group. This is neither saved-group deletion nor permission undo.
Accepted POST remains saved even when subsequent list refresh fails. No member
is added by selecting a group or discarding its new-name draft.

## Design review
Non-submit Discard group name draft below Add group, explicit name-only help.
1278x899 desktop and 390x844 mobile pixels inspected: action/help/rules/full receipt
readable without horizontal overflow. Mobile name/role/locales/list above view.
New unsent name follows earlier discard; receipt describes earlier discard.
List stale after 503 by design.

## Security review
No backend/auth/default/worker/credential change, account, spend or license choice.
Only disposable local PostgreSQL/browser groups, no members added. Reset does not
change saved role or locale grants and does not change anyone's access.
Existing group authorization checks remain unchanged.

## QA review
Seven new units: initial scaffolding wrongly used newGroupName instead of groupName,
causing six failures; corrected fixture only, web actual/API cached RC0. First web
build actual/API cached RC0. Initial fixture-generation substring error prevented
browser creation and its first syntax check reported missing module. Corrected
fixture generated and syntax RC0. Focus actual PG/browser first 8PASS/0FAIL RC0;
whole-method no-op 1PASS/2FAIL RC1 at overlong-name clear; restored 8/0 RC0.
No GET/write/delete on discard, independent form/error/role/locales stay,
pending button/direct guard, actual accepted MEMBER/he groups without members,
including after 503, mobile/runtime checks, zero tasks/translations/deliveries.
API batches a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55
first RC0. Sync95+144=239/native116+111+19=246 first RC0, each native stage
in its own call, native PG55968. Config16/14/docs4/glossary harness3/runner4
first RC0. Browser001..204 first2318PASS/zeroFAIL RC0, each suite own call.
Completed results preserved across run boundaries, not an uninterrupted run.
Final web/API units and builds RC0, all cached. Final docs4, browser-script
syntax and git diff checks RC0. Latest desktop/mobile pixels re-inspected after
204: action/help/rules/full receipt fit without overflow; mobile controls above
view as noted. No application fix was required for scaffolding errors.
Coverage 22FULL/7PARTIAL/1MISSING and default OFF unchanged.
