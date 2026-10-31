# 0118 - Owner-only linked identities list

## Developer pass
Account API filters by authenticated user ID and selects only id/issuer/email/
createdAt; no caller-supplied account selector. Session-only plus second-factor
step-up. No-store response. UI clears entries on reload/destroy and ignores stale
async results. Route guard and Projects entry point, retry after load failure.

## Product pass
Read-only linked identities, not account merge, identity unlink, local password
setup or a claim that provider email was verified. Both linking routes remain
available. No external IdP acceptance or coverage promotion.

## Designer pass
Inspected1280x850/480x850 populated and480x850 empty pixels. Long issuer and
HTML-looking metadata wrap without overflow, rendered as literal text. Labels
explain metadata and read-only limits; empty state is clear. Existing navigation
remains readable. Retry is tested after injected transport503.

## Security pass
Authenticated owner filter, session-only and second-factor checks enforced at
API, not just UI. API tokens rejected. Explicit projection omits subject and
secrets. HTML-looking issuer/email are Angular text bindings, not HTML/links.
No-store response and cleared stale UI data. No delete/write capability added.

## QA/integration pass
Existing SAML-link suite16->32 checks. Added read-only click-through, metadata,
exact response field allowlist, unauthenticated/API-token/current-factor checks,
cross-account isolation, no-store, literal HTML, long narrow layout, empty state,
transport-error/stale-clear/retry, account route guard. Real API/PostgreSQL and
browser with signed local mock issuer; no external acceptance. Initial29 tests
passed; added no-store and failure/retry checks, all32 pass.

Final verification:47 unique sweep legs all individualRC0,42 integrations in
eight completed fail-closed batches all outerRC0. API205/24 suites, web24/5,
both builds and reaper4 RC0. Broad visual temporary checkpoint stages116+128
PASS (244 total, two repeated startups,242 unique); every source assertion label
covered, both stages inner/outerRC0. Staged, not uninterrupted, verification.
Temporary runner and private checkpoint removed. No failures this slice.
