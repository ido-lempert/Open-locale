# 0506 Loaded matched-locale status in saved-text results

## Developer review
Projects matched translation status from the existing key response alongside
value and source context. Missing status remains null. Source status cannot
supply target status. Existing result generation and scope clearing apply to
status too. No added request, endpoint or write. The439 JSON report explicitly
projects its previous fields and remains unchanged; status is UI-only here.

## Product review
Any-status searches now distinguish reviewed, translated and project custom
statuses without reopening the editor. Labels say loaded saved status and deny
live review confirmation. Later server changes appear only after explicit new
search. Missing status is unavailable, not fabricated unverified. Coverage and
external acceptance claims remain unchanged; workers stay default OFF.

## Design review
Actual desktop and390px screenshot pixels inspected. Status sits directly below
matched locale heading; custom text wraps. Target and source remain distinct;
mobile stacks and scrolls without horizontal clipping. No reliance on color
alone to explain status. Tall existing form still needs scrolling.

## Security review
Only already authorized response data is projected. Angular text interpolation
escapes hostile returned status; no HTML insertion. No automatic refresh,
mutation, upload, audience, credential change or spend. Pending/edit/project
changes clear private old status; late responses cannot restore it. No download
schema or hidden-data expansion.

## QA/integration review
New5units, web1374 in134; API265 in31cached; both builds0cached after initial
web build0. First focused browser aborted0PASS with400 from invalid custom-status
setup. Fixture uses accepted APPROVED and tests hostile text via intercepted
response instead. Next10PASS then abort and next6PASS then abort were fixture
DOM races on repeated search; response/network/exact-key rendering waits fixed
these with no app change. Final13/0 and restored13/0. Old app discriminator
0PASS missing new status element abort, as intended. Full interim logs retained.
Real PostgreSQL different source/target statuses, custom status, explicit newer
refresh, one existing GET/zero writes; intercepted missing/hostile text and late
private status; responsive/runtime checks. APIa/b/c/d,sync-preview644,2fa37,saml55
first0. Automations132/0RC0 first actual invocation using12 unchanged-source
bundles prepared separately, temporary invocation skips only bundling with
existence checks, unchanged assertions/sleeps/DB setup/cleanup; fresh55813 and
cleaned. Separate sync95+144=239unique and native116+111+19=246total242unique/four
startup repeats, each stage first inner/outer0. Config16/14/docs4/reaper4 all0.
All133 isolated browser suites first0, 1441 assertions, no failed assertions
or source changes during sweep. Final docs consistency checked after evidence update before commit/push.
No uninterrupted-run claim.
