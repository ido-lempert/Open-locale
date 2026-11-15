# Discard local add-member email draft

## Developer review
Clear raw memberEmail only, including malformed or whitespace input. Busy blocks
button and direct method. No API/reload/member or access mutation. Selected
role/locales, other forms and errors stay. Existing membership receipt becomes
accurate discarded-email wording; no saved result is invented.

## Product review
Email-only label/help preserve next explicit Add's chosen grant. This is neither
member removal nor an undo of accepted membership. Accepted POST survives failed
refresh. Membership can be upserted: receipt says saved, never created.

## Design review
Non-submit Discard member email draft below Add with explicit scope help.
1278x899 desktop and390x844 mobile pixels inspected: button/help/full receipt
readable without horizontal overflow. Mobile email/role/locales/member list above
view; team-wide access warning remains visible. New unsent email follows earlier
discard; receipt describes earlier discard. Final capture follows successful
upsert refresh, unlike separate intercepted503 leg.

## Security review
No backend/auth/default/worker/credential change, account, spend or license choice.
Only disposable local users/memberships, no mail/invitations or external calls.
Email discard does not change anyone's saved role/locales or access. Existing
team-wide membership and union-grant warning stays unchanged.

## QA review
Seven new units first web actual/API cached RC0; first build same. Focus real
PG/browser first9PASS/0FAIL RC0, whole-method no-op1PASS/2FAIL RC1 at invalid email
clear, restored9/0 RC0. No GET/write/delete on discard, independent form/error,
role/locales preserved, pending direct/button guard. Actual MEMBER/he memberships,
accepted POST then503, existing-member upsert with saved-not-created receipt.
Zero task/translation/delivery rows and runtime errors; mobile fit.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239/native116+111+19=246 firstRC0, each native stage its own call,
nativePG55968. Config16/14/docs4/glossary harness3/runner4 firstRC0.
Browser001..205 final2327PASSzeroFAILRC0, each suite own call,203 first passes.
149 first15PASS1FAIL at immediate filter edit removing download/feedback.
Diagnostic16/0 showed tag missing, download/notice absent, tag input focused;
exact first failing DOM not captured and cause remains unproved. Two render
frames after tag typing retain original absence assertions. Corrected16/0;
negative removing only setTag clear15/1 at same assertion; restored16/0.
Fixture stabilization only, no application fix. 181 first0/1 before assertions:
PostgreSQL address in use on127.0.0.1:55954. Port probe then refused connection;
retry11/0, no process killed or app change. Other203 suites firstRC0.
Final web/API units and builds all cachedRC0; docs4, both affected browser
scripts syntax and git diff checksRC0. Latest desktop/mobile pixels re-inspected
after205, button/help/receipt fit as noted above. Completed stages preserved
across run boundaries, not an uninterrupted run. Coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.
