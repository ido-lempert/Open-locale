# Discard local offline provider name draft

## Developer review
Clear raw newMtName only, including whitespace/overlong input. Busy blocks button
and direct method. No API/reload/remove/run. Keep provider type, pretranslation
choices/result, errors and independent forms. Existing accepted-provider receipt
becomes accurate discarded-name wording; reset invents no accepted receipt.

## Product review
Name-only reset, not provider deletion or pretranslation cancellation/undo.
Provider type stays for the next explicit Add provider. Accepted POST remains
success even if later provider-list refresh fails. Offline pseudo only, no real
translation/provider enablement. Existing Add behavior unchanged.

## Design review
Non-submit Discard provider name draft below Add, plain name-only/type-stays help.
1278x899 desktop and390x844 mobile pixels inspected: action/help/rules/full receipt
and pretranslation choices/result readable without horizontal overflow. Mobile
name/type/list/pseudo warning above view. New unsent name follows earlier discard;
receipt describes earlier discard. List stale after503 by design. Earlier result
is explicitly seeded fixture state, not an executed pretranslation.

## Security review
No backend/auth/default/worker/credential change, account, spend or license choice.
Only disposable local PostgreSQL/browser offline pseudo fixtures; no real MT or
external requests. Reset triggers no pretranslation, translation or delivery,
and does not change saved provider or rule choices.

## QA review
Seven new units first web actual/API cachedRC0, first build same. Focus actual
PG/browser first8PASS0FAILRC0, whole-method no-op1PASS2FAILRC1 at overlong name
clear, restored8/0RC0. Fixture-only wording corrected from access to type; removed
irrelevant empty token-mask operation before negative/restored. No app fix.
No GET/write/delete on discard, type and independent form stay, pending button
and direct guard, actual accepted providers retained after503, choices/result
and errors preserved, mobile/runtime checks, no pretranslation request or DB
translations/deliveries. APIa/b/c/d and separate sync-preview644/automations132/
2FA37/SAML55 firstRC0. Sync95+144=239/native116+111+19=246 firstRC0, each native
stage own call, checkpoints cleaned/nativePG55968. Config16/14/docs4/glossary
harness3/reaper4 firstRC0. Browser001..202 first2302PASSzeroFAILRC0 each own call, no retries or fixture/app
changes during broad checks. Final web/API units and buildsRC0 all cached.
Docs4/0, affected browser script syntax and git diff checksRC0. Latest desktop
and mobile pixels re-inspected after202: action/help/rules/full receipt/choices/
result readable without horizontal overflow. Stage/run boundaries retained, no
uninterrupted sweep claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
