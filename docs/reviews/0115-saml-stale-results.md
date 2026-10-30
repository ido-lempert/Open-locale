# 0115 - Discard stale SAML browser results

## Developer pass
Generation ownership covers handoff redemption and second-factor completion,
new fragment callback, restart and destruction. Only the current generation
updates tokens, pending factors, errors and busy state. Clear stale code too.
No network cancellation or rollback of already-completed server actions.

## Product pass
Late successful SAML results cannot replace a newer rejected fragment callback
or navigate away after the user left. This is local browser hardening only, not
external provider acceptance, SAML identity-link UI, or a coverage promotion.

## Designer pass
Inspected actual480x800 pixels after releasing a successful late handoff:
newer safe error and Back to sign-in remain, no stale factor form or overflow.
The old-code experiment overwrote its screenshot with Projects as expected;
reran fixed code before inspecting the final screenshot. No new visual surface.

## Security pass
Retain existing verifier-protected handoff and signed-assertion validation.
Tests delay actual successful API responses rather than fabricate tokens.
They assert no token storage/navigation, and absence of pending state directly
as well as in DOM. No changes to signature processing, crypto or provider config.

## QA/integration pass
Browser checks23->35. Four real local API/PostgreSQL/mock-signed-issuer scenarios
cover access token/newer callback, access token/destruction, pending second
factor/newer callback, and successful second factor/newer callback. All assert
held response success before testing late delivery. Old component fails seven
assertions/RC1; fixed component passes35/RC0, repeated after build/unit runs.

Final verification:41 integration legs all individualRC0 with seven completed
fail-closed batches, all outerRC0. API204 tests/24 suites, web24/5 suites,
both builds, and four reaper checks RC0. Broad visual242 PASS, innerRC0 and
outerRC0. Total46 sweep legs plus broad visual; no interrupted batches here.
