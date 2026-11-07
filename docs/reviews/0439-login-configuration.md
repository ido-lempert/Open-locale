# 0439 Independent login provider configuration recovery

## Developer review
Independent OIDC/SAML reads have separate loading/error/configured state and retry.
Pending duplicate/destroyed/busy retry guards precede effects; late state writes
remain alive-fenced. Parallel initialization prevents SAML latency blocking OIDC.
Prior lifecycle unit updated for parallel sibling reads, late flags still fenced.
No API/schema/dependency changes.

## Product review
Configuration read failure is visible rather than silently hiding sign-in choices.
Each retry rereads that provider only, preserving password/email/2FA draft and
password error. Password login stays available even during held provider reads.
Successful disabled configuration is distinct from read failure. Retry never starts
sign-in or changes provider/account settings.

## Design review
Actual desktop/390px failure-state pixels inspected: both bounded provider errors
and distinct retry buttons fit above usable password form. Pending provider status
replaces its retry action. Configured choices appear independently. Local intercepted
provider-info responses are not production provider acceptance evidence.

## Security review
Fixed errors exclude raw provider failure text. Retry cannot replay password,
start sign-in, clear session/handoff state or expand configuration authority.
Normal server auth/state/PKCE/second-factor checks unchanged. Disposable local
password fixture only. Original owner upload authority/live target verified.

## QA/integration review
Four new units, web788/69 API265/31 builds0. Browser8 real browser socket fixtures:
each held oneGET/no sibling read/no start/draft preservation, independent OIDC while
SAML held, actual password login succeeds with provider read pending. Initial6PASS
2FAIL sampled retry removal before DOM; explicit pending/hidden waits then8/0,
no app fix. Identity-refresh regression twice6/1 sampled disabled before render;
explicit disabled/confirmation-hidden waits fixed fixture then7/0. All API/isolated
browsers final0. Sync separate95/144239unique; native separate116/111/19=246total
242unique/four repeats inner/outer0. Final configs16/14/docs4-138routes/reaper4 all0,
checkpoints gone. Continued across run boundary, no interrupted tests or restarted
completed checks/canonical uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/
defaultOFF unchanged.
