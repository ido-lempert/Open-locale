# Preserve unrelated Settings drafts after direct member locale-scope Save

## Developer review
Refresh members only after accepted scope-only update. Parsed/deduplicated snapshot,
optimistic accepted scope, newer raw text, pending guards and receipt remain.
Unit mock uses actual listMembers with prior assertions retained. No API/schema change.

## Product review
Scope Save must not erase unrelated general/new-group/rule drafts. Second explicit
Save, blank-all grant, refusal and accurate receipt on503 remain. Group grants combine.

## Design review
Help explains members-only refresh and retained forms. Four real scope/discard desktop1278x899/mobile390x844 screenshots inspected14:03:
readable/fit. Scope mobile begins at input; discard mobile at button, target role
and name above viewport.

## Security review
Disposable local members only. Mutation payload and server authorization unchanged.
Retain real API proof of removed/saved locales and inherited grant union. No live
user account, worker, spend, scope or license change.

## QA review
Real browser/API/PostgreSQL proof adds limited GET and unrelated-draft checks,
retaining previous assertions. Initial units/build RC0 webactual/APIcached.
FocusFIRST17/0; deliberate broad-reload negative15PASS/2FAILRC1; restored17/0.
Related member-discardFIRST12/0.
API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 currentRC0.
Automations first aborted before assertions on occupied receiver55870; temporary
receiver-port-only copy56031 recovered132/0 RC0. Tracked fixture unchanged and
copy removed. Other API suites firstRC0. Full regression complete: 219 browser suites FIRST2542PASS/0FAIL, each own call.
Sync95+144=239 and native116+111+19=246 FIRST0, staged separately.
Sync config16/native config14/docs4/glossary reset3/runner4 checks RC0.
Final units/build RC0, each 2/2 cached; initial actual web checks retained.
Final docs4/syntax1/diff checks RC0. Four screenshots re-inspected15:35:
readable and fit; mobile scope starts at input, discard at button with target
name/role above viewport. No source/fixture changes during broad regression.
Developer/PM/design/security/QA passes closed after this final evidence review.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
