# Preserve automation drafts edited during Add

## Developer review
Snapshot the full raw name/trigger/action/provider/locales/title/message before
POST and build its outgoing payload from that snapshot. After POST succeeds,
clear existing four draft fields only if the entire draft still matches. Any
changed field preserves the whole draft, including unchanged companion fields.
Existing selectors remain selected. No automatic replay or second POST. Review
fix uses snapshot directly for outgoing fields and removes unused harness state.

## Product review
A successful earlier POST is not a save of newer typed text. Explicit receipt
says submitted rule saved/newer draft kept and not saved, with review before Add.
Receipt clears on next valid attempt; invalid or busy calls leave it alone. POST
failure does not claim saved. List-refresh failure after successful POST still
keeps accurate receipt alongside the existing error. No persistence on reload.
Edits made after clear during the refresh already remain; no new receipt claimed.

## Design review
Receipt uses role=status near the form. Desktop1278x899/mobile390x844 pixels
inspected readable wrapped notice and literal newer name, no document overflow.
Existing rules and action choices stay visible; no panel redesign.

## Security review
Local draft retention only, not new permission or rule-effect approval. Existing
busy/name/active-template guards retained. Literal markup stays text, no raw draft
in receipt. No real rule/worker enablement, external delivery, account/security/
token-scope changes, registration, spend or license choice. Fixtures local only.

## QA review
14newunits:all7fields changed while POST pending, unchanged clear, edit/revert,
edit during refresh,POSTfailure,refreshfailure,invalid/busy and next-attempt
receipt lifecycle. Fullweb2071/176actualfirstRC0/API265/31cached0;reviewed web
actual RC0. Initial/reviewed builds webactual/APIcachedRC0. Focused first11/0,
oldapp1PASS2FAILRC1,restored11/0,reviewed11/0 after snapshot refactor. RealPG
heldPOST/duplicateblock/exact old payload/newliteralname+message+trigger retained/
onlyoldpersisted/refreshedlist/secondexplicitAdd/unchangedclear/actionswitch/
403draft-norefresh-nosavedclaim/503refreshfailaccuratesavedreceipt+DBpersisted.
APIa/b/c/d,sync-preview644/automations132/2fa37/SAML55allfirstRC0. Sync95+144=239/native116+111+19=246allfirstRC0,separatecalls/stages,not uninterrupted. Config16/14/docs4/harness3/reaper4first0. Browser178firstcompletedRC0/2054PASS/zeroFAIL;006 initial call interrupted by provider before output (zero-byte log, no live process on two checks), reissued61/0.Final units/build bothcachedRC0,docs4/0,diffcheckclean. Latest desktop/mobile pixels reinspected readablewrapped/nooverflow. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.
