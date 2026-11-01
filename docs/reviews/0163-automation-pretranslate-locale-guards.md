# 0163 - Current context before each pretranslate locale

## Developer pass
Await shared current-intent/captured-rule guard before each target locale. Guard
is outside per-locale MT error catch so rejection exits remaining locale sequence;
outer rule catch records failure. Existing ordinary MT errors retain per-locale
reporting/continuation. No MT implementation changes. No new worker/checkpoint.

## Product pass
After one target locale commits, later source/rule context revocation stops later
locales while preserving prior fill. This is not whole-rule rollback or per-rule
retry deduplication. No enabled worker/public execution/baseline advance/remote
write/external acceptance;coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Current native1280x800 editor screenshot inspected for readable locale
columns, saved state and memory suggestion without overlap. Existing UI evidence
only, no new visual-feature claim. README/plan identify pre-locale boundary.

## Security pass
Existing current actor/admin/target/key/value/lease guard and captured rule revision
check run before each target. Target revision change, database-clock lease expiry
and authenticated disable/restore between target locales stop further writes.
Point-in-time only: no guard inside MT write transaction or after provider work;
post-check races remain. No registration/credential scope/spend/license change.

## QA/integration pass
Automation62->68: three cases each prove actual first offline MT locale fill and
absence of second translation/history/activity. Bundles actual MT service, built-in
pseudo driver, task/project/activity services and PostgreSQL. Post-commit notification
seam injects target/lease/rule mutation; a wrapper awaits that seam deterministically,
while production MT notification stays fire-and-forget. Not a mock MT result or
external provider acceptance. Existing explicit summary failure doubles retained.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 clean
fail-closed batches,all individual/outerRC0;48 inventory. Webhook45,migration10,
sync268/browser98. Native116+128=244 total/242 unique,all242 literal source labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. No failing test
or host interruption97. One harmless inspection named nonexistent drivers.ts,
actual import points to mt.providers.ts. No active fixture services/temp bundles.
