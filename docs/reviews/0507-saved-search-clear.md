# 0507 Clear saved-text search filters locally

## Developer review
A guarded clear handler uses the existing generation-incrementing clear path,
then resets query/status/tag/match to empty/any/any/contains. Project, branch,
locale, source locale and loaded options remain. No request, endpoint or write.
Clear stays available during a pending request and fences its late response.
Idle empty state, unresolved options and departure refuse captured handlers.
Result/download feedback is cleared together, not left as stale confirmation.

## Product review
One local action returns a narrowed search to a fresh text query without manual
clearing of four controls. It does not reset branch/locale or silently requery.
The label and adjacent scope text name that behavior. No translations are
changed. Existing base-value/loadedmetadata/nonpaginated/snapshot limits stand.
This changes no capability coverage or external acceptance status.

## Design review
Actual desktop and390px pixels inspected. Clear sits beside Search with a
separate button type, readable label and adjacent retained-scope explanation.
Mobile wraps controls and explanation without horizontal overflow. Existing tall
form still needs scrolling. No destructive-server wording or confirmation is
needed: only local search scope/results clear, not translation edits.

## Security review
No upload, network call, mutation, new audience, credential change or spend.
Old private values/status/download feedback disappear on clear. Late held
responses cannot repopulate those values; errors also return to clean idle.
No reset of authorization scope or recreation of stale project options.

## QA/integration review
New8units/fullweb1382 in135, API265 in31cached, builds0bothcached after initial
webbuild0. Focused first12/0 and restored12/0, no fixture or app fixes. Intentional
oldapp0PASSmissingclearcontrolabort; full log retained. Actual local browser
controls/fourfilterreset/retainedscope/zero requests/writes after clear, explicit
new search reads realPG data, loaded result/status/download removal, pending
clear/lateprivate response fence, errorclear/no retry, responsive/runtime.
APIa/b/c/d,preview644,2fa37,SAML55 first0. Automations132/0RC0 first actual invocation
with12 separately prepared unchanged-source bundles; temporary invocation skips
only bundling with existence checks, all assertions/sleeps/DB setup/cleanup
unchanged, fresh55817 and cleaned. Separate sync95+144=239unique and native
116+111+19=246total242unique/four startup repeats, each firstinnerouter0.
Config16/14/docs4-138routes/reaper4 all0. Isolated browser sweep001-058 and060-134 first0. Suite059 first0PASS1FAIL
startup abort: PostgreSQL fixture55610 could not bind. /proc/net/tcp showed a
loopback TIME_WAIT connection to API3000, no live listener owner. Waited for
actual bind success, unchanged rerun059 passed5/0RC0. Both full logs retained,
no app/test/source change. All134 completed, 1453 passing assertions, no app assertion failures or source changes during sweep.
README/PLAN evidence updated; final docs checked before commit/push. Staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
