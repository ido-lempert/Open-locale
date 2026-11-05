# 0356 - Named snapshot restore actions

## Developer review
Attribute binding names each Restore action with its row label; visible text and
existing confirmation unchanged. Angular text/attribute binding handles special
characters without markup interpretation. No method/API/schema change. No app/test
changes after native stages.

## Product review
Repeated restore buttons now expose their target label without requiring surrounding
row context. Duplicate snapshot labels still produce duplicate action names; this
change does not promise unique identity or alter confirmation/selection semantics.

## Designer review
Inspected actual480x1043 full-page pixels: compact Restore text retained, special-
character snapshot label readable as literal text. Browser checks every button's
aria-label against row label. No broad accessibility or screen-reader certification
claim; no layout change or broad responsive claim.

## Security review
Markup-like label remains literal text/attribute value, not HTML. Actual canceled
confirmation produces no restorePOST and retains current draft. No new account,
provider, scope, disclosure, spend, license or registration. Original owner upload
recovered and live repository/push/main checked before publication.

## QA/integration review
API265/31/web304/14 uncached0/builds0. Snapshotbrowser34->36 actual every-row named
restore/compact visible text plus quoted markup-like label literal/no nested b,
real canceled dialog containing exact label/no restorePOST/currentdraft retained.
49unique bounded integration/config legs all inner/outer0 incl docs4/138routes,
config16/reaper4. No290 failures/timeouts/interruption. Each browser/native stage
isolated. Syncbrowser STAGED95+144=239unique both0/checkpointremoved, not canonical
uninterrupted. Native STAGED116+128=244total/242unique both0/checkpointremoved, not
uninterrupted. No app/test changes after verification.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.35kBvs500warning (prior586.31kB).
