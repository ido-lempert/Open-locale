# 0136 - Repository draft UI

## Developer pass
Target comparison offers explicit base/local/remote choices for every difference,
including one-sided changes, retaining same/converged values. Choices persist
across50-row pages; selection edits invalidate prior draft. Preparation uses saved
target revision/scoped fingerprint, no caller file values. Shared busy guard stops
duplicate requests and selection edits in flight. Scope generation suppresses late
draft/error/busy changes. All comparison invalidations clear choices/draft. Any
resolve failure requires a fresh comparison. Exact-byte JSON download with revoked
object URL. No new API, persistence or effects.

## Product pass
Draft JSON/counts/SHA256 review and download are clearly not applied. Absence
omits draft key only. No import/repository write/sync action or baseline advance.
README/plan updated. Coverage22FULL/7PARTIAL/1MISSING unchanged. Sync apply and
external provider acceptance remain open work, not complete integration claims.

## Designer pass
Inspected real desktop/480px screenshots and scrolled narrow selection controls.
Widened desktop content to fit six columns; narrow table scrolls internally.
Explicit labels, missing/empty displays and manual row text/tint retained. Draft,
digest, notice and download fit without document overflow. Fixed screenshot
scroll position so sticky header does not float mid-document in full-page evidence.

## Security pass
No new network scope or credential handling. Server recomputes all sources and
checks reviewed fingerprint. DOM interpolation keeps values inert. Failure clears
old comparison/selection/draft; late successful response cannot disclose old-project
bytes. No apply authority implied by provenance or digest. No external enrollment,
expanded token scope, spending or license choice.

## QA/integration pass
Browser83->92: explicit completeness, exact selected sources, no effects, exact
byte download, narrow fit, changed-selection invalidation, stale remote failure,
paged selections and held successful draft across reused-route navigation.
Web44->47/7: completeness/duplicate/in-flight selection guard, failure invalidation,
late destroy/navigation. API244/29, sync150 retained; builds/reaper4 RC0.
Initial browser fixture failed syntax at zero checks due reused variable name;
renamed fixture variables, clean92 reruns.43 integration/config legs across14
completed fail-closed batches all individual/outerRC0 (visual config9->10).
Native visual first attempt ran0 checks: PostgreSQL port55434 bind failed and
runner printed INCOMPLETE but cleanup exited0. Never counted green. Exit guard
plus bounded stop now fail closed; discriminating occupied ephemeral-port test
passes without timeout. Initial negative fixture hit the same contended default
port, then unbounded cleanup timeout; corrected ephemeral port/stop bound. Used
explicit local test port55483 for both final stages, no other processes stopped.
Final native visual116+128=244/two repeated startups/242 unique, all source labels
covered, both inner/outerRC0, checkpoint removed. Staged, not uninterrupted.
48 sweep inventory legs include43 integration/config plus units/builds/reaper.
