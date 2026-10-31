# 0127 - Repository target configuration

## Developer pass
Persist local branch/locale to owner/repo/path/remoteBranch mapping. Session-admin
CRUD, UUID paths, DTO bounds, shared transport-coordinate validation. Whitelist
coordinates only, unique local branch/locale, project100 cap under row lock.
Optimistic update/delete revision protects stale edits; concurrent update one
winner. Branch UUID FK/cascade added after review caught branch name reuse risk.
Project cascade, bounded list. Config has no credentials, baseline or execution.
Branch FK loss during concurrent save becomes scope-changed409, not raw DB error.

## Product pass
Metadata only, not repository connection. Every response connected=false,
baselineAccepted=false,canApply=false. No remote GET/PUT, token grant, baseline,
accepted sync or worker. No UI yet. Existing file preview/draft flow unaffected.
OpenAPI covers126 routes, including four new operations. No coverage promotion.

## Designer pass
No UI change. Explicit stale revision409/reload and unknown scope404/locale400,
bounded list/no-store. Existing sync UI42 browser checks and native visual
regressions retained. Do not present this API as a connected repository screen.

## Security pass
Session only and project admin before reading or parsing scope. Write API token,
member, outsider denied. Project-bound target IDs prevent cross-project mutation.
Only safe coordinate fields persisted, never caller token/connected/revision claims.
Shared validator rejects traversal/control/empty/URL-shaped identifiers; percent
path encoded rather than decoded. No remote credentials or outward effects.
Branch deletion removes config; recreated name cannot inherit old target. Project
row lock serializes create/update/delete and cap race across processes. Revision
is configuration concurrency only, never permission for future sync effects.

## QA/integration pass
Five new shared validator unit tests, API235->240 in27->28 suites. Real DB/HTTP
sync65->93: creation/list/no-store, unique scope, forged fields ignored, update/
stale delete, concurrent revision one winner, required revision, invalid scope/
coordinates, member/outsider/token/admin, cross-project ID/list boundaries,
configuration-only delete, branch deletion/recreation, project cascade, cap race
at99->100 (one success, one400), list bound, no diagnostic/translation writes.
Web29/6 and both builds/reaper4 RC0.43 integration/config legs in nine completed
fail-closed batches all individual/outerRC0; units/builds/reaper give48-leg sweep
inventory. Native staged visual116+128=244 total/two repeated startups/242 unique,
every source label covered. Both inner/outerRC0, checkpoint removed. Staged, not
uninterrupted. No new screenshot because no UI changes.

Interim failures: GET fixture helper defaulted undefined body to coordinates;
fixed helper and reran. Migration old-schema fixture copied later migrations
while omitting branch creation; new FK exposed relation-missing failure. Fixed
fixture to stage only historical prefix before enum-to-text, preserving seeded
old-row/status/branch-backfill assertions. Normal full fresh migrations passed.
Completed migration8/RC0 and replacement batch. Combined sweep call hit120sec
during OIDC-link-browser startup; incomplete batch not counted. Killed orphaned
web descendants and removed55480 socket only after zombie owner/TCP refused
checks. Entire affected batch rerun clean. No failed checks hidden or promoted.
