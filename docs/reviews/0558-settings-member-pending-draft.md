# Preserve member drafts edited during Add

## Developer review
Snapshot raw email/role/locales before POST; derive existing trimmed email and
parsed locales from that snapshot. Clear email/locales only if all three still
match after success; otherwise preserve the whole newer draft with receipt.
Direct busy guard blocks duplicate calls. Existing role retention/reload remain.
No backend/schema/upsert change.

## Product review
Add can create or update a team membership, so receipt says saved, not created.
Review email, role and locales before explicit resubmission. No automatic second
POST or persisted draft. Busy call keeps receipt; next nonbusy attempt clears it.
POST refusal makes no saved claim; refresh failure keeps accurate saved receipt
and existing error. Edits during reload already remain after old draft clear.

## Design review
Receipt role=status beside form. Desktop1278x899/mobile390x844 pixels inspected:
complete readable email/role/locales and wrapped receipt, no horizontal clipping.
Existing team-wide scope/locale/admin guidance remains visible. No list redesign.

## Security review
Snapshot/receipt is not permission validation. No raw draft echoed into receipt,
no automatic membership/role/locale change. Server admin/role/target/locale checks
remain authoritative. Only local demo users and demo team grants in browser test;
no external invitation, production grant, worker, credential-scope, registration,
spend or license change.

## QA review
10newunits:three pending fields,unchanged,editrevert,editduringreload,POSTfailure,
reloadfailure,busy,nextreceiptclear. Fullweb2130/182actualfirstRC0/API265/31cached;
buildwebactual/APIcachedRC0. Focusedfirst11/0,isolatedoldclear1PASS/2FAILRC1,
restored11/0. The discriminator substitutes unconditional clearing only, not full
old HEAD. RealPGheldPOST/exacttrimemailroleparsedlocales/duplicateblock/whole
newer/oldonlyDB/secondexplicitAdd/unchangedclear/403noreloadnoclaim/503accurate
receiptoldonlyDB/existingmembershipupsertaccuratesavedreceipt. After initial
focused proof, corrected unit description name->email and isolated fixture temp
prefix/database name only. APIa/b/c/d,sync-preview644,automations132,2fa37,SAML55allfirstRC0.
Sync95+144=239/native116+111+19=246allfirstRC0separatecalls/stages,
not uninterrupted. Config16/14/docs4/harness3/reaper4firstRC0.
Browser001-184allfirstRC0/2119PASS/0FAIL.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.

Final unit targets RC0: web actual rerun after description-only change, API cached;
final builds both cached RC0. Latest184 desktop1278x899/mobile390x844 pixels
re-inspected: whole newer draft and complete wrapped receipt readable, no
horizontal clipping. Final docs/diff checks precede commit.
