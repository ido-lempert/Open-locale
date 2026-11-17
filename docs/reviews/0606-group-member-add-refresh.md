# Preserve unrelated Settings drafts after group member addition

## Developer review
Refresh groups only after accepted member addition. Submitted-member snapshot,
newer unsent choice, pending guards and receipt remain. Unit mock uses actual
listGroups with previous assertions retained. No API/schema change.

## Product review
Adding a group member must not erase unrelated general/new-group/rule drafts.
Explicit second Add, refusal and accurate accepted-add receipt on503 remain.

## Design review
Help explains limited refresh and kept forms. Four real member/discard desktop1278x899/mobile390x844 screenshots inspected10:51:
readable/fit. Member mobile starts at selector; discard mobile at button, group name
above viewport.

## Security review
Only disposable local fixtures. Membership mutation payload and server authorization
unchanged. No live user account, worker, spend, scope or license change.

## QA review
Real browser/API/PostgreSQL proof adds groups-only GET and unrelated draft checks
while retaining prior assertions. Initial units/build RC0 webactual/APIcached.
FocusFIRST13/0; deliberate broad-reload negative11PASS/2FAILRC1; restored13/0.
Related discardFIRST10/0.
Final five-perspective closeout: limited refresh matches the accepted operation;
mutation payload, pending protection and accurate receipt behavior unchanged.
No further code fixes. Four final member/discard screenshots inspected12:20:
readable/fit, with mobile scroll positions as described above.
API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 firstRC0. Sync
staged95+144=239 and native116+111+19=246 (four startup repeats) firstRC0,
each stage separately; native port56024 environment override only.
Browser219 FIRST2538PASS/0FAIL; no app or fixture changes during broad verification.
Config sync16/native14/docs4/glossary-reset3/runner4, syntax1/diffRC0.
Final API/web units/build RC0 (2/2cached each).
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
