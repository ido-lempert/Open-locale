# Settings automation rule-name limits

## Developer review
Existing trimmed outgoing name checked max120 using installed validator surrogate/
presentation-pair count before busy/error/API. DTO allows empty names: remove
inconsistent native required, no invented nonblank rule. Combine name and active
payload checks, keep busyguard. Existing valid create/name-trim/listrefresh/clear/
failure/pretranslate/effect semantics unchanged. No backend/schema change.

## Product review
Invalid full name and all choices stay local, correction without reload. Empty
name semantics explicit. Not permission/provider/locales/delivery validation.
Existing automation effect warning remains; no automatic repair or activation.

## Design review
Linked rules/aria-invalid/correction/disabled Add. Desktop1278x899/mobile390x844
pixels inspected readablewrapped/nooverflow; existing long singleline scrolls.
No redesign of existing verbose automation explanation.

## Security review
Local checks not DTO/authz replacement. Literal markup stays input text; existing
runtime permission and whitelisted effects unchanged. Local fixture rules only,
no real rule/worker enablement, external delivery, account/security/token/spend/
registration/scope/license change.

## QA review
21newunits:12actualbackendcount comparisons,3invalidactionchoices/state/API,
correction/exactUnicode+activepayload,2blanknames,activepayloadstillguarded,busy,
validfailure. Fullweb2036/174actualfirstRC0/API265/31cached0;buildwebactual/API
cachedRC0. Focusedfirst13/0,oldapp0PASS2FAILRC1,restored13/0. RealPGkeyboard121/
presentation121local/noGETPOST/invalidnameblocksall3actions/Unicode120namepersist
trimmedwithrawmessage/busyduplicateblocked/refreshclear/whitespacenamepersistsempty/
validnamecannotbypasspayload/valid403literalrawnamechoiceserror/norefresh.
APIa/b/c/d,sync-preview644/auto132/2fa37/SAML55allfirst0. Sync95+144=239/native116+111+19=246allfirst0separatecalls/stages,not uninterrupted. Config16/14/docs4/harness3/reaper4first0. Browser176latestRC0/2031PASS/zeroFAIL;174firstRC0. 149first15PASS1FAILRC1 filter edit download-control/feedback compound assertion, unchanged rerun16/0 after independent150/151; root cause unproven, no fix. 070firstPG55640EADDRINUSE0PASS1FAILRC1/outgoing55640->3000TIME_WAITstate06inode0/bind98, unchanged rerun5/0 after independent071/072. Original failed logs retained. Final units web actual/API cached RC0; final build both cached RC0. Latest desktop/mobile pixels reinspected: readable wrapped guidance/correction, disabled Add, full singleline text scroll, no document overflow. Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptance
unchanged.
