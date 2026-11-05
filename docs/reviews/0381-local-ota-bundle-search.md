# 0381 - Local search in retained OTA inspection

## Developer review
Computed case-insensitive literal substring filter over loaded key/value entries,
then existing50-row local pagination. No regex or HTML interpretation.200-character
query bound, exact whitespace preserved. Search/clear resets page; page bounds use
filtered count. Scope visit resets query, refresh keeps query but clears rows,
destroy suppresses search. Three unit cases cover Hebrew/case/punctuation/markup,
off-page matches/zero matches, reset/clamp, no fetch and route/destroy semantics.

## Product review
Find a retained key or value without scanning every page. Matched/total count,
clear button, explicit current-downloaded-locale literal/case-insensitive scope.
No-match text differs from genuinely empty publication. Existing publication UUID
pin, read-only/current-retention/no-client-receipt caveats remain. Full bundle still
fetched; this is local search, not server pagination/global search/linguistic folding.
No API/schema/worker/default/acceptance changes.

## Designer review
Actual390x844 matching and no-match pixels inspected. Search input, match count,
clear control, page controls, UUID/caveats and long literal value readable, no
overlap/horizontal overflow. Distinct no-match guidance avoids claiming empty
publication. Existing styling/status region reused; no new authored asset.

## Security review
Query never sent over network, no new mutation/audience. String includes only,
plain Angular interpolation. HTML/regex punctuation are literal. Existing member/
outsider/read denial checks retained. Route/reset clears old text; no search over
other project/locale. No credential/spend/registration/license/worker change.
Original named-repo upload authority recovered before publication.

## QA/integration review
API265/31 web322/16 uncached/builds0. OTA browser19->25 final inner/outer0: actual
off-page retained value case-insensitive search, empty-value key match, literal
regex no-match, literal HTML/no overflow, zero network reads across search/clear,
query-only route clears filter. Prior19checks retained incl pin branch-recreation.
All51 bounded integration/config legs final inner/outer0. Docs4/138routes/config16,
reaper4. Each browser and native stage isolated. Sync STAGED95+144=239unique and
native STAGED116+128=244total242unique final inner/outer0, checkpointsremoved.
No canonical uninterrupted claim. No failure/timeout315; no app/test edit after
stages. Docker static-only, coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

Final bundle598.82kB vs500warning (previous597.74kB).
