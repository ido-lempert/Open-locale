# 0105 - Browser local-file sync preview

## Developer pass
New project route and editor link. Fetch project locales/branches, require
explicit baseline/remote file strings and caller SHA. Results render via text
interpolation only. Input changes clear old result/error, invalidate in-flight
requests; stale success/failure cannot reappear. Subscribe to project route
params to reset scope/files on reused route, unsubscribe/invalidate on destroy.
No apply endpoint or action. API carries the actual session/admin checks.

## Product pass
Named File sync preview, not GitHub connection. Prominent provenance and
no-write warning, session-admin/flat-only limits. Empty baseline not prefilled:
user must supply their known baseline, including explicit {} if appropriate.
Results distinguish missing and empty string, conflicts/deletions manual.
No baseline/remote verification, credential setup, persistence or active sync.
GitHub coverage remains MISSING; this is local comparison UI only.

## Designer pass
Desktop two-column form and comparison. At 480px, form stacks and table gets
its own horizontal scroll, not document overflow. Text tells readers to scroll
for all columns. Inspected actual desktop/narrow captures; labels, provenance,
manual highlighting and no-apply notice readable. Changed notice text from
inherited green to dark amber on pale amber to match caution semantics.

## Security pass
No localStorage for file contents, no new credentials, no egress. Angular text
interpolation for file data avoids HTML execution. Server rejects unauthorized
member/API token requests. UI max lengths/patterns mirror API limits but are
not relied on for security. Scope/input invalidation prevents stale preview
misrepresentation; results never grant effect authority.

## QA/integration pass
Real browser -> Angular -> API -> PostgreSQL checks: editor click-through,
provenance, three directions/conflict, empty label, no apply action, narrow
scroll/no document overflow, clear stale output on input edit, invalid JSON
error with no old preview, input edit during held real API request discards
response, unchanged database values, member error with no preview.
First run crashed after 11 assertions because fixture request listener stayed
active when interception was disabled. Removed listener before disabling,
cleaned leftover server group, reran successfully. This was a fixture fix.
No external GitHub/IdP requests or provider acceptance.
