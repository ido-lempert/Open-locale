# 0432 Loaded webhook recorded status filter

## Developer review
Computed projection matches existing persisted success boolean; complete array,
object identities and scope untouched. Exact all/succeeded/failed allowlist,
destroy guard; route visit resets status, explicit reread retains it. Existing
pending/error/stale-read fences unchanged. No API/schema/dependency changes.

## Product review
Focus failed/succeeded records among up to50 retained recent deliveries. Count,
no-match/Clear and loaded-only scope explicit. HTTP success is not processing
confirmation, journal is not complete history. No send/retry/worker enablement,
automatic polling or newer-data claim.

## Design review
Actual desktop/390px screenshots inspected. Label/native selector/Clear/count
readable and separated from Refresh. Long literal event wraps without overflow;
HTTP/attempt/duration/time and success caveat remain legible. Evidence transferred.

## Security review
Allowlisted local status selection, no new account reads/writes or disclosures,
provider/account/credential/license/spend changes. Existing admin authorization
and secret/error omission unchanged. Failed read cannot become empty success by
changing filter. Original upload authority/live target checked before push.

## QA/integration review
Unit4 boolean match/original objects/full set/no reads/unknown input/destroy/
route reset/current read/failure remains failure. Browser8 actual persisted HTTP204,
HTTP503/no-response failed, Clear no requests/writes, explicit read retains status,
failed read remains failure, same-component new webhook resets status/no-match.
API265/31 web755/64 builds0 initial444.16kB. All API/isolated browser regressions0;
sync separate95/144239unique, native116/111/19 (246total242unique/four repeats),
inner/outer0. Final16/14/docs4-138routes/reaper4 all0. No failed/interrupted checks
or canonical uninterrupted claim. Checkpoints removed. Coverage22FULL7PARTIAL/
1MISSING/defaultOFF and external acceptance unchanged.
