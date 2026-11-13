# Settings pseudo-provider name limits

## Developer review
Existing trimmed outgoing name checked max120 with the installed validator's
surrogate/presentation-pair count before busy/error/API. DTO allows empty names;
remove inconsistent native required. Direct busy guard prevents overlap. Existing
create/name trim/list refresh/clear/first selection and failure behavior unchanged.
No backend/schema/provider implementation change.

## Product review
Invalid full name/type stays local, correction without reload. Empty names remain
API-valid. Name checks do not validate duplicates, permission or availability.
Adding the built-in offline pseudo provider does not run pretranslation. External
MT/AI engines remain unavailable and the existing test-data warning stays visible.

## Design review
Linked rules/aria-invalid/correction/disabled Add. Desktop1278x899/mobile390x844
pixels inspected: readable wrapped guidance/correction and no document overflow.
Existing long singleline input scrolls; no text truncation. No panel redesign.

## Security review
Local validation does not replace DTO/authz or duplicate checks. Literal markup
stays text. No new credential entry, external provider/worker/account/security/
token-scope enablement, registration, spend or license change. Only local pseudo
fixtures created; no pretranslation request or external delivery.

## QA review
21newunits:12actual backend count comparisons,3invalid state/API cases, Unicode
correction/refresh/first selection,2blank names, preserved earlier selection,
busy guard and server failure. Fullweb2057/175actualfirstRC0/API265/31cached0;
buildwebactual/APIcachedRC0. Focused real-PG browser first12/0,oldapp0PASS2FAILRC1,
restored12/0. Keyboard121/presentation121 full raw local/noGETPOST, Unicode120
trimmed create with duplicate busy block, refresh/clear/first selection, trimmed
empty persisted, earlier selection retained,403 literal raw draft/no refresh,
zero pretranslation requests and no runtime errors. APIa/b/c/d,sync-preview644/automations132/2fa37/SAML55allfirstRC0. Initial APIa wrapper PermissionError before suite launch corrected by invoking existing batch script through bash; no source change. Sync95+144=239/native116+111+19=246allfirstRC0 in separate calls/stages, not uninterrupted. Config16/14/docs4/harness3/reaper4firstRC0. Browser177allfirstRC0/2043PASS/zeroFAIL. Final units/build both cached RC0, finaldocs4/0 and diffcheck clean. Latest desktop/mobile pixels reinspected readable/wrapped/nooverflow.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
