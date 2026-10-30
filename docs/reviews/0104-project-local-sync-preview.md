# 0104 - Project-scoped local-file sync preview

## Developer pass
Added POST /projects/:projectId/sync/preview. Explicit branch, locale,
baselineJson and remoteJson raw JSON strings plus remoteSha. Uses stored local
translations, not caller local values. Repeatable-read transaction keeps SQL
budget preflight and Prisma relation fetch in one snapshot. Bound local key
count and text bytes before materializing; reject unsupported plural metadata
before fetching JSON forms. Fingerprint includes project, branch identity,
locale, key identity and translation rowId/version, not only text values.
No persistence, effect, remote transport call or apply endpoint.

## Product pass
Local-file preview only: caller baseline and remote are unverified; response
says baselineVerified=false, remoteVerified=false, canApply=false. SHA is a
caller label, not evidence of a fetched provider file. Explicit branch required,
unknown locale/branch rejected. Flat-only and request file fields each limited
to 32768 characters. Full GitHub setup, validated baseline storage, journal,
remote read, conflict selection, apply and UI remain open. No coverage upgrade.

## Designer pass
API-only change; no screen or visual regression claim. Future screen must
explain caller-file provenance, preview-only state, direction and conflicts.
OpenAPI documents route, session/admin policy, required fields and limitations.

## Security pass
Session admin required; API tokens (including write scope) denied. Existing
live membership checks hide other-team projects; members denied even with
locale write grants. Validate project UUID. No URL, token or repository input,
no egress, secret storage or logging. Raw file strings allow duplicate-key
validation despite DTO transformation. Parameterized SQL and repeatable-read
budget before fetch bound local allocation; plural branches rejected.
No-store response. Fingerprint is diagnostic, not approval or execution lock.

## QA/integration pass
Real PostgreSQL and HTTP fixture covers owner/admin, unauthenticated, other
team, locale-limited member, write API token; stored local text; conflict,
remote removal, unchanged preview fingerprint, no translation writes; branch
and locale isolation, missing required fields, unknown branch/locale, malformed
and duplicate/nested JSON, invalid SHA, oversized input, invalid UUID, database
byte/count limits, plural rejection and edit/revert row-generation binding.
First run failed a fixture expectation: identical import intentionally skips
unchanged rows. Replaced with real PUT edit/revert to test generation binding.
During budget review one build failed because a SQL result's new unsupported
count was omitted from its TypeScript type; fixed the type before final tests.
No external service setup or real GitHub effects.
