# 0438 Login handler lifecycle

## Developer review
Alive/busy guards precede all password/signup/OIDC/SAML start effects. Providers
also require a configured flag. SAML rechecks alive after digest and start response;
OIDC rechecks after start. Password response cannot store token/navigate after
destruction. Late configuration cannot restore flags or begin sibling read.
Destroy clears password/2FA draft. No API/schema change.

## Product review
Double or competing captured handlers cannot initiate another sign-in while one
is pending. Leaving the screen prevents late browser handoff/session effects.
Already-submitted server requests are not cancelled or undone. Current explicit
password/signup and provider flows remain available. No account/provider changes.

## Design review
Actual pending local SAML screenshot inspected: provider and primary controls
disabled, Working label readable, form layout intact. Configured flag/held digest
are local test doubles, not production provider acceptance. Existing tabs/input
editing retained; it cannot initiate a competing request while busy.

## Security review
Departed handlers cannot write browser token, same-tab state or initiate starts.
Destroyed post-digest SAML cannot POST. Existing server auth/state/PKCE/second-factor
checks unchanged. No saved credentials used for fixtures or provider registration.
Original owner upload authority and live named target verified before commit.

## QA/integration review
Eight new units, web784/68 API265/31 builds0. Browser8 actual observed password
login socket/held crypto proves destroyed handlers, unconfigured provider guards,
no competing requests, late real response cannot replace token/navigate, valid
current login works. Observer covers OIDC GET start as well as POST. Initial7PASS
1FAIL sampled disabled DOM too early; explicit wait fixed fixture then twice8/0,
no app fix. Tasks-row-ready twice aborted before assertions for port55664 bind
collision, no visible matching postmaster; later6/0 without stopping processes or
editing app/fixture. All API/isolated browsers final0. Sync separate95/144239unique;
native separate116/111/19=246total242unique/four repeats, inner/outer0. Final
configs16/14/docs4-138routes/reaper4 all0. Checkpoints removed. Work continued across
run boundary without interrupted tests/restarting completed checks. No canonical
uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
