# 0120 - Fresh-password identity unlink API

## Developer pass
Owner-filtered delete and compare-and-increment authEpoch in one transaction.
Password verified first; transaction rechecks hash/epoch and serializes the row.
Missing/wrong-owner ID rolls back the epoch change. Concurrent calls have one
winner. Invalid UUID rejected before database cast. Explicit sign-in-required
result; no automatic replacement session. API-only, no unlink UI yet.

## Product pass
Local password required, so SSO-only accounts cannot lose their only sign-in
method. Original projects remain. Existing sessions revoked after success;
API tokens are not revoked and this is not claimed otherwise. No external IdP
account action, identity provisioning policy change or coverage promotion.

## Designer pass
No new UI. Existing identity page remains read-only and says unlinking is not
available there. API result explicitly requires sign-in. No UI-completion claim.

## Security pass
Session/current factor/fresh password required. Owner filter, no-store and
transactional epoch change. Review found preexisting pending SSO2FA could mint
a fresh-generation token after epoch revocation; pending OIDC/SAML now capture
epoch, check before second-factor verification and recheck at token issuance.
This revokes already-pending factors, not cancellation of concurrent IdP traffic.
No blanket logout/IdP revocation claim; API tokens unaffected.

## QA/integration pass
SAML-link/identity suite32->48: no-auth/API-token/wrong-password/malformed/other
owner rejection and preserved state/epochs, concurrent one-winner, exact epoch
increment, initiating/old session rejection, local password+factor sign-in and
project preservation, SSO-only guard, pending SAML factor revoked without
consuming recovery code. OIDC browser36->38 tests same pending epoch boundary.
First test expected401 for SSO-only but existing password policy returns403;
corrected fixture expectation, no app change for that failure.

Pending boundary proof: restoring old OIDC pending completion behavior fails both
new assertionsRC1; restored fixed code/rebuilt and final OIDC38 PASS/RC0. SAML48
PASS. Final48 sweep legs individualRC0,43 integration/config legs in eight
completed fail-closed batches outerRC0. API205/24 suites, web24/5, builds/reaper4
RC0. An initial combined OIDC/integration call timed out mid-integration; cleaned
dead task-test socket and reran that entire integration batch cleanly.

NOT READY TO COMMIT: native visual first116 PASS/RC0; second stage twice reached
123/128 checks then exceeded120-second host execution window after narrow report
checks. No FAIL lines but incomplete. Both interrupted test groups and dead PG
socket cleaned. Checkpoint remains private for diagnosis/resume; no full visual
claim. Need inspect final mobile-editor/settings tail, then run it through a
smaller bounded stage or fix any real wait failure before commit.

Visual follow-through completed with a temporary three-stage checkpoint runner:
first116, middle81, final49 PASS;246 total with four repeated API/web startup
checks,242 unique; every source assertion label present. Each command RC0 and
no FAIL lines. The temporary middle/final runner reused the normal stage2 marker
and subtotal, which must NOT be read as full completion by itself. Completion
is established only by three-log aggregate/source-label check. This is staged
verification, not one uninterrupted run. The final49-check run completed the
mobile/settings tail, so no product wait failure was found. Temporary runner
and all private checkpoints removed. Prior two-stage interrupted envelopes
remain incomplete and are not relabeled as successes.
