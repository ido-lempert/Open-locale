# Guard team-member removal confirmation and pending state

## Developer review
Matching loaded non-owner/non-self member required. Busy and same-member role/
locales pending refuse start/submit. Removal blocks same-member saves/discard;
named controls disabled. Accepted DELETE filters target member locally, closes
confirmation, records receipt, then members-only refresh. Refusal retains saved
member and confirmation for explicit retry; missing member cannot replay locally.
Unrelated drafts preserved. No API/schema change or cross-client guarantee.

## Product review
Old native confirm incorrectly described project-only access loss. New warning
says all team projects, account/group membership rows/task assignments/tasks/
translations remain, re-adding can reactivate saved grants, in-progress work may
finish. No account-deletion, task-unassignment or permanent-grant-revocation claim.
Saved group member remains visible in Groups because the server retains it.

## Design review
Four1278x899/390x844 confirmation/accepted pixels inspected. Target name/email,
team-wide scope, re-add warning, controls, receipt and retained add-member draft
readable and fit without horizontal overflow. Other member/owner content partly
above accepted mobile viewport.

## Security review
Disposable local fixtures only. Existing server admin/owner/self protections
unchanged. UI confirmation is extra safety, not authorization. Actual member
access404 in two projects despite retained group admin grant, and explicit local
re-add restores that grant. No external setup/spend/account/worker/credentials/
scope/license change. No new data disclosure.

## QA review
Seven initial units/first buildRC0 webactual/APIcached. Focus FIRST16/0,
matching-confirmation-only deliberate negative0PASS2FAILRC1, restored16/0. No
interim app/fixture failures in focused runs. Actual browser/API/PostgreSQL covers
unconfirmed/mismatch/cancel/owner-self/pending role,403retry, held duplicate/
cancel/replace/same-member saves/discard, accepted503 local+server/receipt/no
replay/drafts and success members-only refresh. Member404 in both team projects
with saved group admin relation; account/group-membership/task assignment and
translation bytes remain unchanged. Explicit disposable re-add reactivates admin
PATCH in second project, then fixture removes membership again. Zero extra tasks/
webhook deliveries/runtime errors.

Full regression: all216 independent browser suites FIRST RC0,2476PASS/0FAIL,
including member-remove16/0. API a/b/c/d plus separate sync-preview644,
automations132,2FA37,SAML55 FIRST RC0. Sync stages95+144=239 FIRST0;
native first116/middle111/tail19 FIRST0 combined246 (four repeated startup
checks across stages). Config sync16/native14/docs4/glossary-reset3/runner4 all0.
Final units/build both cachedRC0; syntax and diff checks0. Initial final-check
invocation used nonexistent npm test alias and returnedRC1 before any tests;
corrected to existing Nx targets, no source/assertion changes. Deliberate negative
is the only assertion-failing run. No unintended app/fixture regression failure.
Five review passes closed after this evidence; scope/authority boundaries unchanged.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
