# 0107 - Repository-read preview composition

## Developer pass
Compose existing Contents read transport with flat JSON three-way planner.
Require baseline bytes plus SHA, verify exact Git blob SHA before network;
parse local/baseline before read; parse fetched remote before returning plan.
Bind fingerprint to owner/repo/path/branch and exact baseline blob identity.
Snapshot mutable caller scope/baseline before await to prevent request/result
identity drift. No writes, retries, partial result, or apply path.

## Product pass
Isolated read-only composition, not wired into HTTP/browser preview, credentials,
connection setup, persistence or baseline journal. Baseline consistency does
not establish provider provenance or approved sync history. Result says
baselineProvenanceVerified=false and canApply=false. No production GitHub
requests or token use during development. Local fixture acceptance only;
GitHub coverage remains MISSING. Existing caller-file UI stays unverified.

## Designer pass
No UI changes or new screen claim. Future connected preview must distinguish
adapter-fetched remote from unverified baseline and show exact target scope.

## Security pass
Reuse fixed-origin pinned transport, no independent URL/credential mechanism.
Caller still owns project authorization and approved credential provenance.
Never read development push token from product code. Validate duplicate/shape
before comparing, reject inconsistent baseline before read; provider errors
sanitized by adapter. Blob SHA is consistency, not provenance authentication.
Copy input target/baseline across async boundary; regression verifies mutation
cannot retarget returned identity after request started.

## QA/integration pass
Nine new real HTTP socket fixture tests: actual read -> compare push/pull,
no write methods; absent/mismatched/duplicate baseline and local inputs before
network; unsupported remote; provider failure single attempt; target/exact
baseline fingerprint binding; mutable scope isolation; conflicts/deletion stay
manual. Initial eight-test run passed; ninth added during review for mutable
caller input drift, and all pass. No externally accepted integration claim.
