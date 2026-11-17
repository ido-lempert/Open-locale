# Limit general project-details Save refresh to project data

## Developer review
Use explicit project-only reload after accepted general update, preserving existing
whole-form raw snapshot and newer-draft comparison/finally semantics. Initial
Settings load still fetches all panels. No API/schema change.

## Product review
General Save should not refetch unrelated tokens, members, groups, OTA, branches,
MT, rules or SAML metadata. Keep explicit second Save, accepted fallback for
Discard, refusal and accurate accepted-save receipt after refresh failure.

## Design review
Help describes project-only refresh and retained forms. Actual general pending
and discard desktop1278x899/mobile390x844 screenshots inspected15:39: readable,
fit with names, description, Save, Discard and full help visible; pending receipt
fits on mobile. Discard screenshot follows refusal and correctly has no receipt.

## Security review
Disposable local project only. Payload, server authorization and raw validation
unchanged; no worker, live account, credential, spend, scope or license changes.
Fewer unrelated GET requests do not imply wider access or fresher other panels.

## QA review
Unit tests retain raw snapshots, held project refresh, failed refresh, refusal,
validation and unrelated initial-load behavior. Prior held later-list browser
leg now holds a second project refresh because list reads no longer occur.
Initial units/build RC0: actual web, cached API. Focus FIRST13/0; deliberate
broad-reload negative11PASS/2FAIL RC1; restored13/0. Related discard FIRST9/0.
Browser206 first aborted before assertions on occupied PG55984 (0PASS/1 suite-abort
FAIL RC1); temporary database-port-only copy56034 recovered11/0 RC0. Tracked
fixture unchanged and copy removed. Other completed browser suites firstRC0.
Final five-perspective review closed: project-only refresh preserves raw newer
drafts, accepted fallback and explicit Save. No further code fixes. Four final
general pending/discard screenshots re-inspected17:10: readable and fit, full
pending mobile receipt visible; refusal discard has no saved receipt as expected.
Browser219 current2544PASS/0FAIL including206 recovery11/0; other218 suites
FIRST2533/0. Original206 startup abort remains above, not an uninterrupted pass.
API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 FIRST0. Sync staged
95+144=239 and native116+111+19=246 FIRST0, four native startup repeats, each
stage separately. Native56033 environment override only. Configsync16/native14/
docs4/glossary-reset3/runner4 RC0. Final units/build RC0 (2/2cached each), initial
actual web execution retained. Final docs4/syntax1/diff RC0. No app/fixture
changes during broad verification. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
