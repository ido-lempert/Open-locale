# 0182 - Manual effect bookkeeping UI

## Developer pass
Typed summary client and explicit manual button,no polling. Shared busy/generation
fence ignores late responses after route load/destruction. Refresh clears prior
counts before request;errors leave no stale count and show generic safe wording.
Existing scope resets clear summary on edit/save/read/compare/apply/delete. No
new mutation or dispatch call. Backend aggregate/auth remains unchanged.

## Product pass
Pending/leased/completed handlers/dead,expired leases,oldest pending and DB asOf
snapshot visible. Explicit not-live/manual-refresh,not-delivery/not-sync,earlier
revisions,terminal retention and worker-unknown notices. Zero queue uses0/None.
No retry/worker-enable control. DefaultOFF flags unchanged,no remote write,
baseline advance,accepted sync or external acceptance.22FULL/7PARTIAL/1MISSING
unchanged. README/plan now reflect summary UI.

## Designer pass
Initial actual desktop/narrow pixels showed touching action buttons. Wrapped
read/compare/summary actions in existing12px gap/flex-wrap group. Final actual
1280desktop and480x900 pixels inspected:clearly separated actions,aligned count
labels,wrapped timestamps,full notices readable,no horizontal overflow. Header
can overlap top of scrolled target heading in screenshot;summary itself complete.
No claim of new overall sync completion. Screenshots attached to parent.

## Security pass
Angular interpolation,no raw HTML. No key/value/actor/token/error details exposed.
Generic summary failure wording hides raw server text. Real held-response navigation
proves old project summary cannot render in new scope. No request on initial page
load,no background polling. Existing endpoint session-admin restrictions retained.
No credential scope,spend,registration,license or audience change.

## QA/integration pass
Web52->55/7:explicit load only,failed refresh clears old data/safe error,late result
fenced after load/destruction. Browser108->117 actual pointer-driven checks:empty,
mixed actual DB state,claim limits/no payload,480fit,failed refresh clearing,reload
without queue mutation,immediate stale clearing,held navigation. Initial physical
click runs aborted at89 twice and90 once:scroll/layout shift missed existing
preview button. DOM-click diagnostic117green isolated harness only,not final
click evidence. Added helper waits enabled,instant center scroll,120ms settle then
real page.click. First pointer run116PASS/1FAIL because stale-cleared assertion
raced Angular render;explicit DOM-condition wait fixed harness. Final lm319+117
clean using physical pointer clicks. No final DOM click substitution.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync319,browser117,
automation123,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. No
startup failure,timeout or interruption116. All final app changes preceded broad
verification;only this review added afterwards.
