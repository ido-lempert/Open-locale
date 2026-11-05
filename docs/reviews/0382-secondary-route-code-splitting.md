# 0382 - Secondary route code splitting

## Developer review
Fifteen secondary route entries load fourteen component modules dynamically
(identity-link component shared). Callback/login/projects/editor remain eager.
Paths, route order, auth guards and SAML provider data unchanged. Sixteen route
unit cases resolve each lazy factory and check guards/eager entries/data/fallback.
No router preloading configured. Existing component scope fences unchanged.

## Product review
Production initial assets shrink598.82->405.86kB below unchanged500kB warning
budget. No total-download/latency/real-network speed claim: visited secondary
screens still fetch their chunks. Deployment must retain hashed chunks for old
clients across releases; stale-chunk recovery is not implemented here. No budget
increase, feature/API/worker/coverage/default changes.

## Designer review
Inspected390x844 actual production-built settings screenshot. Existing layout,
controls and readable hierarchy unchanged with no observed overflow/overlap.
Production navigation verified; no redesign or new screenshot claim beyond this.

## Security review
Lazy loading is not access control: each secondary route retains authGuard;
existing server permission gates unchanged. Production signed-out deep link
redirect verified. Verification server binds loopback only, serves build assets
with path containment and API proxy; test harness, not deployment configuration.
No external service, audience, credential scope, spend, license or worker change.
Original owner named-repo upload instruction recovered before publication.

## QA/integration review
API265/31 web338/17 uncached/builds0. Production-built SPA browser16PASS verifies
no secondary chunks at login/editor, lazy settings and clicked activity, secondary
deep links, account identities and signed-out guard. Existing52 bounded
integration/config legs final inner/outer0 (prior51+production16), docs4/138routes,
config16/reaper4. Existing browser counts unchanged OTA25/activity36/journal16.

Batchd120s timeout interrupted saml after other5 legs completed0 (preserved).
Isolated restart0checks inner0 but batch/reaper1 rejected due stale Unix socket
55476 PID6118 defunct. Left socket untouched. Added validated SAML_TEST_PG_PORT
optional test override; checked55576 free, isolated55PASS inner/outer0. No SAML
application behavior change. No false-green zero-check claim.

Sync STAGED95+144=239unique all inner/outer0/checkpointremoved. Native first116
inner/outer0; second120s interrupted after124PASS without final exit or cleanup
proof. Preserved first-stage checkpoint, no test edits; checked alternate55584
free and reran isolated second128PASS inner/outer0, checkpointremoved. Final
116+128=244total242unique STAGED, not canonical uninterrupted success. Prior
completed checks not restarted. All timeout/cleanup chronology retained. No
app/test edits after final native retry; docs only. Docker static-only,
coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. Initial405.86kB no budget
warning, not a claim that total assets shrink by the same amount.
