# Discard local token name draft

## Developer review
Clear raw tokenName only, including whitespace and long text, with busy guards on
button and direct method. No request/reload/revoke. Keep chosen access, prior
one-time token reveal, errors and independent forms. Update an existing created
receipt accurately; never invent one from a reset.

## Product review
Name-only label/help keep access for the next explicit Create. Saved tokens are
not revoked and access is not broadened. Failed refresh after accepted creation
is not creation failure. Existing Create/reveal/revoke behavior stays unchanged.

## Design review
Non-submit Discard name draft below Create with name-only/access-stays help.
1278x899 desktop and390x844 mobile pixels inspected: action/help/full receipt
readable, no horizontal overflow. Mobile name/list/reveal above view. New unsent
name follows earlier discard; receipt describes that earlier discard. List stale
after503 by design. Fixture token hidden in screenshot DOM only, actual reveal ID
and length verified first, never copied/logged.

## Security review
No backend/auth/default/worker change, external account/credential scope change,
spend or license choice. Only disposable PostgreSQL/browser fixture tokens,
both created read-only and revoked before teardown. The selected read+write is
unsent UI draft, not an expanded credential. Reset does not change saved token
access or destroy the one-time reveal. No external requests.

## QA review
Seven new units first web actual/API cachedRC0; first build same. The enclosing
shell reported detached child cleanup after success; no completed check restarted.
Focused actual PG/browser first8PASS0FAILRC0, whole-method no-op1PASS2FAILRC1
at raw whitespace name clear, restored8/0RC0. No GET/write/delete on discard,
access and independent form preserved, pending direct/button guard, accepted
read-only tokens and reveal retained even after503, accurate receipt/error,
mobile/runtime checks and disposable token revoke verified.
API a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239/native116+111+19=246 firstRC0; each native stage own call,
checkpoints cleaned/nativePG55968. Config16/14/docs4/glossary harness3/reaper4
firstRC0. Browser001..201 first2294PASSzeroFAILRC0 each own call, no retries or fixture
changes during broad checks. Final web/API units and buildsRC0 all cached.
Docs4/0, affected browser script syntax and git diff checksRC0. Latest desktop
and mobile pixels re-inspected after browser201, action/help/full receipt readable,
no horizontal overflow. Stage/run boundaries retained, no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
