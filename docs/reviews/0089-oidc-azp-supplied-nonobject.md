# Review 0089 - OIDC azp-when-supplied and non-object JSON rejection (slice 23 follow-up)

## Why
Review of slice 23 caught two refinements:

1. azp was enforced only for multi-valued aud. But "azp optional for
   single-audience" means the claim may be ABSENT - not that a PRESENT azp
   may be ignored. A single-audience token carrying azp for another party
   was accepted. Now: a supplied azp must ALWAYS name our client_id;
   multi-valued aud additionally REQUIRES azp to be present.
2. Malformed-token handling leaned on JSON.parse throwing. JSON.parse also
   succeeds on scalars and arrays: a signed payload of `5` or `[1,2,3]` is
   valid JSON but not a claims object. Non-object header and payload are now
   explicitly rejected with 401 instead of relying on downstream claim
   checks to fail closed incidentally.

## Test discrimination note
The negative azp legs use a REAL state nonce (via the mock's mint-code with
the authorize URL's nonce). With a valid nonce, the ONLY remaining reason
for a 401 is the azp rule - a 401 caused by nonce mismatch would prove
nothing. The multi-audience negatives fail against the pre-0088 code (which
had no azp rule at all) and the single-audience negative fails against the
0088 code (which checked azp only for multi-aud); all pass now.

## Verification (this HEAD)
- oidc suite: 55 PASS / 0 FAIL / RC=0 (was 50; +5: single-aud foreign azp
  rejected with real nonce, single-aud our-azp accepted as control, signed
  scalar payload rejected, signed array payload rejected, non-object header
  rejected).
- api build RC=0. Full sweep at the final HEAD reported with the commit.

## Boundaries
Same as 0088: SSO/SAML stays PARTIAL; SAML SP code remains unimplemented -
that is outstanding CODE work, not a user-owned acceptance gate.
