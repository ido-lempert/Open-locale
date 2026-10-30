# 0109 - Explicit diagnostic preview records

## Developer pass
Add migration/model for diagnostic preview records. Existing POST /sync/preview
remains non-persistent. New explicit POST /sync/preview-records recomputes the
preview server-side, records actor/scope/fingerprint/caller SHA and counts;
never trusts caller summary/fingerprint/actor. GET lists latest fifty, scoped
to project. Project delete cascades. Records are not executable jobs or accepted
baselines and have no apply/status transition API.

## Product pass
Explicit API opt-in history, no silent change to no-write preview UI. No file
values, key names, credentials or raw baseline/remote JSON retained. Response
keeps caller-file source/unverified/cannot-apply semantics. No GitHub connection,
provider read or actual sync journal claiming execution success. Admin-only,
API tokens denied. Per-project retained history bounded to latest hundred.

## Designer pass
No UI change; no save-history action or history screen yet. Existing compare
screen remains truthful: comparison itself does not persist. Future records
screen must say diagnostic history, not successful sync or accepted baseline.

## Security pass
Recompute authorized preview, recheck admin before persistence, server actor.
No-store list/create responses. Summary only avoids stored file-text disclosure.
Project foreign key cascade. Bounded list and retention. Parameterized SQL and
transactional project lock serialize trimming so concurrent records do not
exceed cap. No remote effects or new credential path.

## QA/integration pass
Real HTTP/PostgreSQL checks add ordinary preview non-persistence, explicit
recomputed record despite forged fields, absent raw file/value fields, scoped
listing, member/outsider/API token denial, invalid preview no record, forbidden
record, latest-fifty cap and project cascade. Retention checked over hundred.
OpenAPI consistency now 118 operations. No UI visual rerun attributed.
