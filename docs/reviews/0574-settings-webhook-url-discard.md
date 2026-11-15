# Discard local webhook URL draft

## Developer review
Clear hookUrl only, raw nonempty including whitespace/invalid values. Busy
blocks button/direct method. No API/reload/webhook mutation. Preserve errors,
event choices, one-time signing-secret reveal and other forms. Existing created
receipt becomes accurate discarded-URL wording; no receipt invented.

## Product review
URL-only label/help deliberately keep selected events for the next explicit
Create. No guessed defaults, deletion, delivery trigger or undo. Saved webhooks
and loaded list stay. Failed refresh after accepted creation is not creation
failure. Existing team-admin rendering/Create/secret behavior unchanged.

## Design review
Non-submit Discard URL draft below Create with plain URL-only/events-stay help.
1278x899 desktop and390x844 mobile pixels inspected: action/help/full receipt
readable without horizontal overflow. Mobile URL/events/list/reveal above view.
New invalid URL follows earlier discard; receipt describes that earlier discard.
After503 list remains stale by design. Fixture signing secret hidden in screenshot,
original reveal ID and length verified before screenshots, never copied/logged.

## Security review
No API call from reset, no backend/auth/default/worker change, no credential scope,
account, spend or license choice. Only local disposable PostgreSQL/browser creates
fixture webhooks. No event-triggering writes, deliveries or external host calls.
Reset does not destroy one-time reveal or change saved webhook/events/secret.

## QA review
Seven new units first web actual/API cachedRC0, first build same. Focus actual
PG/browser8PASS0FAILRC0, no-op1PASS2FAILRC1 at invalid URL reset, restored8/0RC0.
No GET/write/delete on discard, events/other form preserved, pending direct
and button guard, actual created webhook and secret after503 retained, accurate
receipt/error, mobile/runtime checks, zero enqueued/attempted deliveries.
API a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239/native116+111+19=246 firstRC0/stages own call/checkpoints cleaned/
nativePG55968. Config16/14/docs4/glossary harness3/reaper4 firstRC0. Browser
001..200 final2286PASSzeroFAILRC0 each own call;199 first passes.
189 first3PASS2FAILRC1 at pending-submit check; later saved-role assertion passed.
Two diagnostic runs10/0 showed one correct ADMIN PATCH, pending true, newer MEMBER
local draft and disabled Save. Exact first-run DOM state was not captured and the
failure did not reproduce under instrumentation. Two animation frames after
physical select/save now allow rendering to settle; all assertions retained.
Corrected10/0RC0; whole-method setGroupRole no-op negative2PASS1FAILRC1 missing
PATCH; restored10/0RC0. Fixture stabilization only, no app fix during broad checks.
Final web/API units and buildsRC0 all cached (first units/build web actual).
Docs4/0, both affected browser scripts node syntax checks and git diff checkRC0.
Latest desktop/mobile pixels re-inspected after browser200: action/help/full
receipt readable without horizontal overflow, with mobile URL/events/list/reveal
above view. No canonical uninterrupted sweep claim; staged checks and the 189
failure/diagnostics/correction/negative/restoration chronology are preserved.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
