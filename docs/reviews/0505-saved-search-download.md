# 0505 Loaded saved-text match report download

## Developer review
Guarded local-only JSON download projects result id/key/value/sourceValue and
explicit schema/kind/scope, project, source locale and filters. No raw translation
objects, provider metadata or hidden fields. Missing source remains null and
empty remains empty string. Fixed filename and URL cleanup in finally including
click failure. Refuses idle, pending, failed, departed or no-project state; empty
successful read is a valid explicit empty report. Edits/new searches clear notice and
readiness through existing result generation lifecycle. No API/backend change.

## Product review
A user can retain the current match report for offline review. It is not a
complete project export/import file/plural-form report or newer server snapshot.
Both UI and JSON identify current-loaded-only scope. Private text warning is
visible. Success notice says download requested, not saved/shared confirmation.
No implicit uploads, sends, retry or search. Existing loadedmetadata/base-only/
nonpaginated/snapshot limits remain.

## Design review
Actual desktop and390px pixels inspected. Button has an explicit JSON label;
scope/privacy text and requested-download notice sit above results and wrap.
No page overflow. Mobile is taller and requires scrolling, but controls and
source/target sections remain readable, not clipped horizontally.

## Security review
Only already-loaded authorized values are serialized with JSON.stringify into a
local Blob. No dynamic markup or CSV formulas. Fixed filename avoids query/key
paths; URL revoked on success and click error. Private previous results and
feedback disappear on edits/pending/errors; captured handler also checks guards.
No new audience, network request, mutation, credential/worker/account/license/spend.

## QA/integration review
New10units/web1369 in133/API265 in31cached/builds0APIcached. Focused first8PASS
then abort reading notice before Angular rendered it; added selector wait, next
11PASS1FAIL pending DOM checked before loading rendered. Added loading selector
wait; same app final12/0 and restored12/0, no app fix from these fixture races.
Both actual full interim logs retained. Actual downloaded browser JSON parsed:
exact scope/projection/source null-vs-empty/escaped markup,0 requests/writes,
Blob revocation, fixed failure, idle/edit/pending/error refusal, empty report and
390px/runtime. Intentional oldapp1PASS1FAIL missing new download control abort;
full log retained, restored current12/0. All132 isolated browser suites first-attempt0,1428 assertions/no failed assertions
or source changes during sweep. APIa/b/c/d,sync-preview644,2fa37,saml55 first0.
Automations132/0RC0 first actual invocation with12 unchanged-source bundles
prepared separately and a temporary copy skipping only bundling with file-existence
checks. All assertions/sleeps/DB setup/cleanup unchanged; fresh fixtureport55809
verified. No timeout/lock abort this slice; temporary invocation/artifacts cleaned.
Separate sync95+144=239unique and native116+111+19=246total242unique/four startup
repeats, every stage first-attempt inner/outer0. Config16/14/docs4-138routes/reaper4
all0; final docs checked after evidence update. Results preserved across
continuations, staged rather than uninterrupted. Coverage22FULL7PARTIAL1MISSING
and default-OFF workers unchanged.
