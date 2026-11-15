# Discard local automation rule name draft

## Developer review
Clear raw newRuleName only, including whitespace/overlong text. Busy blocks
button/direct method. No API/reload/rule mutation or action run. Keep trigger,
action, provider, locales, active/inactive title/message, errors and other forms.
Existing saved receipt becomes accurate discarded-name wording, none invented.

## Product review
Name-only label/help avoid silently changing delegated behavior. This is neither
rule deletion nor undo, disable or run. Rule choices/payload stay for next explicit
Add rule. Accepted POST remains saved even when later list refresh fails.
Existing rule grants, authority checks and best-effort warnings stay unchanged.

## Design review
Non-submit Discard rule name draft below Add rule, explicit name-only help.
1278x899 desktop and390x844 mobile pixels inspected: action/help/rules/full receipt
readable without horizontal overflow. Mobile name/trigger/action/title/list and
existing automation warning above view. New unsent name follows earlier discard;
receipt describes earlier discard. List stale after503 by design.

## Security review
No backend/auth/default/worker/credential change, account, spend or license choice.
Only disposable local PostgreSQL/browser rules, no event-triggering writes after
rule creation, external calls or enabled worker changes. Name reset does not
change saved delegation, create a rule or trigger effects. Existing automation
permission and delivery warnings remain unchanged.

## QA review
Seven new units first web actual/API cachedRC0, first build same. Focus actual
PG/browser first8PASS0FAILRC0, whole-method no-op1PASS2FAILRC1 at overlong clear,
restored8/0RC0. No GET/write/delete on discard, independent form and message/action
stay, pending button/direct guard, actual accepted rules after503, active title
and inactive message/errors retained, mobile/runtime checks, zero DB tasks,
translations/deliveries. APIa/b/c/d and separate sync-preview644/automations132/
2FA37/SAML55 firstRC0. Sync95+144=239/native116+111+19=246 firstRC0, each native
stage own call, checkpoints cleaned/nativePG55968. Config16/14/docs4/glossary
harness3/reaper4 firstRC0. Browser001..203 final2310PASSzeroFAILRC0 each own call;202 first passes.
130 first0PASS1FAILRC1 at initial count-focus timeout. Diagnostic repeated failure
with zero reads/writes, input active, Search enabled at timeout. No search had been
submitted; exact earlier focus-time DOM unknown. Second pre-focus probe showed
enabled/canSearch true and passed10/0. Two animation frames after typed input now
let rendering settle; original keyboard/focus/request assertions retained.
Corrected10/0; whole focusAfterRender no-op0/1 timed out without submission capture,
repeated negative0/1 with correct he/Needle GET, rendered3 matching count and no
count focus (zero writes); restored10/0RC0. Fixture stabilization only, no app fix.
First failure cause remains unproved; do not claim it as confirmed render timing.
131..203 firstRC0. Final web/API units and buildsRC0 all cached, docs4/0,
both affected browser scripts syntax and git diff checksRC0. Latest desktop/mobile
pixels re-inspected after203: action/help/rules/full receipt readable without
overflow. Stage/run and failure chronology retained, no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
