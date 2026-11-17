# Preserve unrelated Settings drafts after direct member-role Save

## Developer review
Refresh members only after accepted role-only update. Submitted role snapshot,
optimistic accepted role, newer choice, pending guards and receipt remain.
Unit mock uses actual listMembers with prior assertions retained. No API/schema change.

## Product review
Role Save must not erase unrelated general/new-group/rule drafts. Second explicit
Save, refusal and accurate accepted receipt on503 remain. Group grants still combine.

## Design review
Help explains members-only refresh and retained forms. Four real role/discard desktop1278x899/mobile390x844 screenshots inspected12:24:
readable/fit. Role mobile begins at selector; discard mobile at button, target role
and name above viewport.

## Security review
Disposable local members only. Server authorization and mutation payload unchanged.
Inherited group grants remain. No live user account, worker, spend, scope or license change.

## QA review
Real browser/API/PostgreSQL proof adds limited GET and unrelated-draft checks,
retaining previous assertions. Initial units/build RC0 webactual/APIcached.
FocusFIRST13/0; deliberate broad-reload negative11PASS/2FAILRC1; restored13/0.
Related member-discard first11PASS/1FAIL:503 fixture still targeted former project
GET, so no failure was injected. Changed only interception to members GET with
all assertions retained; rerun12/0.
Broad API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 currentRC0.
Permissions/review first aborted before assertions on occupied PG55454/55456;
temporary database-port-only copies56027/56028 recovered50/0 and34/0 RC0.
Tracked fixtures unchanged and temporary copies removed. Other API suites firstRC0.
Final five-perspective closeout: members-only refresh matches the accepted role
update. Payload, pending protection, accepted state and grant behavior remain.
No further code fixes. Four final role/discard screenshots inspected13:59:
readable/fit with mobile scroll positions described above. Sync staged95+144=239
and native116+111+19=246 (four startup repeats) firstRC0, each stage separately;
native port56026 environment override only. Browser219 FIRST2540PASS/0FAIL;
no app or fixture changes during broad verification. Config sync16/native14/docs4/
glossary-reset3/runner4, syntax2/diffRC0. Final API/web units/build RC0 (2/2cached each).
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
