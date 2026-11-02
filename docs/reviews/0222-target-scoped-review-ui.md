# 0222 - Explicit target-scoped archived review UI

## Developer pass
Manual scope dropdown defaults to value-only,selects existing target by ID,and uses
separate target review endpoint. Only displayed value-review fields stored in UI
state,not raw recovery/baseline bindings. Target label captured at review. Target
change clears private text and fences late responses;unrelated busy work prevents
scope changes. Existing cancel/hide/navigation generation fences retained.

## Product pass
Read-only review only,no restore action. Scope choice explicitly names branch,
locale,repository/path;notice names reviewed target and timestamp. Direct team admin
requirement stated. No execution route,worker enablement,remote write or baseline
advance. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
Actual480x900pixels inspected:focused blue result outline,target label/path and UTC
notice wrap readably,escaped value/hide/check buttons visible,no horizontal overflow.
First card begins partly behind sticky header but entire result region visible;
second card continues below viewport. Dropdown accessible label and native select.
Local fixtures only. Screenshot deletion-target-review-narrow.png.

## Security pass
Unknown targets rejected without reads. Scope change clears prior private value and
fences held actual HTTP response. Displayed text Angular-escaped;raw binding objects
not retained in result signal. API response still exists transiently in browser,
not a memory-erasure guarantee. Actual target review leaves translation absent and
queue count unchanged. No restore control introduced. Existing route/error/cancel
privacy tests retained.

## QA/integration pass
Web74->77/7,browser151->156. Initial browser parse-name collisions fixed before
startup;then duplicate main/en target fixture collided with existing target,corrected
to update existing target. Corrected/final156RC0. Sync578RC0. All43unique integration/
config legs via9completed green batches plus standalone sync/browser,individual/
outerRC0. API248/30,both builds,reaper4RC0,migration22,automation132,webhook45,137routes.
No startup issues,timeouts/interrupted calls156. Native staged116+128=244total/
242unique,all literal labels covered,inner/outerRC0,checkpoint removed. Staged,not
uninterrupted. No app changes after final runs,only docs. No production/external
acceptance claim.
