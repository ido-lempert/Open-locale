# Search loaded activity metadata

## Developer
Computed local filtering uses an explicit metadata allowlist, not JSON or detail serialization. Literal substring matching is case-insensitive and trims the query, capped at200 characters. Loaded items, cursor and server filters remain intact. Refresh/filter reads retain local query; project changes reset it. Destroyed component rejects captured search changes. Existing metadata download still serializes all loaded items.

## Product
Finds entries within currently loaded pages without extra reads. Scope text separates local search from server filters and Load more. Match count and no-local-match message avoid implying there is no server history. Raw detail, translation/comment text and actor emails are excluded. Clear local search restores the existing loaded list without server requests; Clear activity filters keeps its original server-filter meaning.

## Designer
Inspected actual desktop and390px screenshots. Search input, Clear local search, scope text,0-of50 count, empty-local-match message and Load more are readable without horizontal overflow. Server filter controls remain separately labeled in the header. No matches still leaves pagination reachable.

## Security
Only actor display name, action code/label, key and locale are searched. Raw detail and private errors are never searched. Native text binding, no regular expression or HTML insertion. Search has no mutation or disclosure side effect. Download still carries its existing private-metadata warning and exact scope.

## QA and integration
- Focused activity units57/0 initially. Final nonoverlapping web stages136files/1693tests +136files/1541tests =272 unique files/3234tests. Final tests include literal/case/whitespace matching, labels/codes, missing actors, excluded private detail, query limit, destroyed/project/reset/read behavior. Existing exact JSON-content download assertion now runs under a no-match query, proving all loaded entries remain included.
- Enhanced activity-clear browser10/0 initial and restored: local filtering/clearing with unchanged actual request counts, explicit no-match and available pagination, plus existing server-filter races/retry checks.
- Negative probe removed only query case normalization. Exactly the uppercase literal-match check failed,9pass/1fail,exit1. Restored10/0.
- Other affected activity browser36/0 and download browser11/0. Total57 affected browser assertions. Real HTTP/PostgreSQL activity32/0.
- API/web builds, docs consistency4/138routes, script syntax and diff checks passed. No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
