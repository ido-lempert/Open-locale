# Guard group-member removal confirmation and pending state

## Developer review
Matching loaded group and member required. Busy and same-group work pending
refuse start/submit; during removal same-group saves/member changes/deletion and
discard refuse. Accepted DELETE filters only target membership locally, clears
confirmation and records receipt before groups-only refresh. Refusal keeps
membership/confirmation/drafts for explicit retry; no full Settings reload.
Existing group-edit draft values remain, effective grant display recomputes from
updated groups. No API/schema change; no cross-client concurrency guarantee.
Native visual fixture updated proactively to click actual inline confirmation,
retaining its existing chip-removal and inherited-note assertions.

## Product review
A group membership is a team-wide grant, not a project-only row. Warning names
member/group, says direct membership and other group grants remain and group task
assignments/tasks/translations are not changed. No undo or complete-access-
revocation promise. API deletes only group-member relation; group/tasks remain.

## Design review
Four1278x899/390x844 confirmation/accepted pixels inspected. Member/group target,
scope warning, controls, receipt and retained new-group draft readable and fit
without horizontal overflow. Group-members section remains muted by existing
style; accepted other-group membership content partly above mobile viewport.

## Security review
Disposable local fixtures only. Existing strict role-above-group API enforcement
unchanged. UI confirmation adds safety, not permission. Two projects prove admin
PATCH through group grant before removal and403 after, direct visibility remains.
No external setup/account/spend/worker/credential/scope/license change.

## QA review
Nine initial units/first buildRC0 webactual/APIcached. Focus FIRST17/0, deliberate
matching-confirmation-only negative0PASS2FAILRC1, restored17/0. No interim app or
fixture failure in these runs. Actual browser/API/PostgreSQL covers unconfirmed,
wrong-group/wrong-member/cancel, pending group edit,403retry, held removal blocks
duplicate/cancel/replacement/group deletion/same-group saves/member/discard,
accepted503 local+server/receipt/no replay/drafts and success groups-only refresh.
Only selected membership deleted, direct/other group/other person memberships
remain. Member loses actual admin grant in second project but retains visibility.
Both group-assigned task rows across two projects and translation rows byte-for-
byte unchanged. Local effective role recomputed without stale admin note.
Zero webhook deliveries/runtime errors. Full regression pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Completed regression
All215 browser suites current2460PASS/0FAIL, each own call. All first attempt
except139 and203:139 one pre-check PostgreSQL55790 bind abort,203 two pre-check
PostgreSQL55980 bind aborts. TCP refused, port-table state06 TIME_WAIT observed.
Failed logs preserved; no source/assertion changes.140 passed then139 recovered
8/0;204/205 passed then203 recovered8/0. Not all-first-pass browser.
API groups firstRC0 including sync-preview644,automations132,2FA37,SAML55.
Sync95+144=239 and native116+111+19=246 FIRST RC0, each stage own call.
Config16/14,docs4,glossary harness3,runner4 firstRC0; final units/build both
projects cachedRC0.

Four confirmation/receipt desktop/mobile pixels re-inspected after broad regression, readable and no overflow, existing muted member-section style retained.
