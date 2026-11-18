# Explicit read-only webhook-list Refresh

## Developer review
Project-scoped metadata GET only. Preserve unrelated state, prior rows while
pending/on failure, reveal identity and copy feedback. Pending duplicates refuse.
Epoch/project/lifetime guard fences results after later explicit Create, matching
delete, enable-disable or departure. Full reload invalidates before webhook GET.
No schema/API changes. Invalid no-event Create does not invalidate the snapshot.

## Product review
Explicit metadata snapshot, not endpoint health or delivery verification. Help
states no endpoint contact, copying, creation, deletion or enablement and warns
kept reveal may belong to webhook no longer listed. Empty list remains valid.
No worker enablement or external receiver call. Failure keeps last snapshot and
bounded explicit retry, never a saved or authenticated claim.

## Design review
Named button and pending/status text with linked scope help. Actual success and
failure desktop1278x899/mobile390x844 images inspected04:48: readable and fit.
Mobile heading above viewport and later controls below. Disposable secret DOM
redacted same-length R only after actual unredacted390px overflow assertion.

## Security review
No raw errors/secret bytes in feedback or logs. Local API/Postgres webhook rows
only; no worker started, tasks/tokens/deliveries remain empty. Explicit fixture
disable uses real PATCH; metadata refresh itself never changes active state.
Negative fence test discriminates actual delete/Create/disable stale snapshots.
No live credential, registration, spend or license change.

## QA review
Twelve new unit cases: state preservation, bounded failure/retry/empty, duplicate,
busy/destroy/project, late Create success/failure, delete and both toggle states.
Initial units/build RC0, actual web/APIcached. Focus FIRST4PASS/1suite-abortFAIL
RC1: next Refresh after screenshot viewport reset did not start the held read.
Fixture re-centers button and waits two frames before the same native click;
14/0 RC0. Deliberate epoch guard removal11PASS/3targetedFAIL RC1. Restored14/0
RC0. Related delete13/toggle11/Copy19 FIRST RC0. No app changes during fixture
repair. 225 browser suites FIRST2638PASS/0FAIL, all RC0, each suite separate.
All API batches FIRST RC0 including tags9/preview644/automations132/2FA37/SAML55.
Sync95+144=239/native116+111+19=246 FIRST RC0, each stage separate; native56054,
four repeated startup checks. Configsync16/native14/docs4/glossary-reset3/runner4
RC0. No app/fixture changes during broad checks. Final units/build RC0,2/2cached each; initial actual web runs retained.
Final five-perspective review found no further fixes. Four success/failure images
re-inspected06:22: readable/fit with mobile caveats above. Final docs/syntax/diff
checks follow this closeout text. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged.
