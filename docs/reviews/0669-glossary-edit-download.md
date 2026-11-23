# Download local glossary term edit

## Developer
Explicit local JSON serialization includes only the bound project/term identity and raw term, notes and boolean fields. Invalid and stale text remains copyable. Active save blocks download. Departed project/visit, destroyed component and closed editor cannot download. Snapshot-bound feedback disappears on edits or uncertainty changes; UI edit events clear feedback even on exact revert. Fixed filename and object-URL cleanup cover anchor success and failure. Existing loaded-row and new-term exports are unchanged.

## Product
Closes the separate editor's local-copy gap without calling its output an import or restorable backup. Labels say server state is unconfirmed, no write is authorized and downloading neither saves nor retries. Unknown writes remain unknown. Export excludes translation drafts and new-term form; scope warning names private text. Raw whitespace is retained rather than Save trimming.

## Designer
Inspected actual desktop and390px scrolled-mobile screenshots: download control and full privacy/scope warning fit below Save/Close, readable without overlap. Existing checkbox alignment and focused translation text remain intact. The panel scrolls normally on narrow screens.

## Security
Fixed JSON Blob, no dynamic HTML or network destination. Explicit payload mapping excludes translations, other terms, new-term form and private exceptions. Bound identity remains the original edit identity rather than a newer list. Fixed failures do not expose exception details. Download is local only; no sharing or authorization change.

## QA and integration
- Focused units43/0, including raw bytes, scope, stale/invalid/unknown copies, pending/closed/departed guards, URL cleanup and feedback invalidation.
- Planned nonoverlapping web stages136 files/1681 tests plus136 files/1513 tests =272 unique files/3194 tests. Staged, not uninterrupted coverage.
- Real browser21/0 initial and restored, plus21/0 in affected regression. Reads actual downloaded file bytes, confirms exact bound identity/raw fields and excluded unrelated data, pending disabled state, failed-write uncertainty and refreshed stale edit copy without replay.
- Negative probe changed only exported term identity. Exactly its download-boundary assertion failed20pass/1fail,exit1. Source restored and normal21/0 passed.
- All16 affected glossary browser suites197 checks passed. Real PostgreSQL/HTTP glossary29/0, final API/web build, docs4/138routes, script syntax and diff checks passed. No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING,disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
