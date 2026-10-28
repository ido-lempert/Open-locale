# Review 0008 - Key tags + search/status/tag filters

Scope: tags on keys (create + dedicated setTags endpoint), list filters combining
search, tag and status-in-locale; editor filter bar and inline tag editing.

## Pass 1 - Developer
- Tags stored as a Postgres text array on keys (migration 20261028171500), matching the
  existing scopes pattern; filtered with the has operator, indexed lookup is cheap at
  this scale (a GIN index is a Phase 2 scale item, recorded).
- setTags trims, dedupes and drops empties server-side; 20 tags max, 40 chars each (400).
- Status filter requires a locale (status is per translation, not per key); the filter
  composes with search and tag (AND semantics, proven).

## Pass 2 - Product manager
- Filter bar: search, tag, status-in-current-locale (the same locale selector the
  import/export controls use - one locale concept on the page).
- Tag chips read at a glance; editing is one click on "tags" in the key cell.

## Pass 3 - Designer
- Finding from screenshot inspection: the tags and history links visually concatenated.
  Fixed with spacing and re-inspected. Chips are neutral pills; filter controls match
  the toolbar rhythm and wrap on mobile.

## Pass 4 - Security researcher
- Tags are plain metadata: no new permissions needed; cross-team setTags and filtered
  list access denied 404 (proven). Tag input length-capped against abuse.

## Pass 5 - QA / integration
- tags-filters-test.mjs (real PostgreSQL + HTTP): 9/9 - create with tags, tag filter,
  trim/dedupe, 20-tag and 40-char limits, status+locale filter both directions,
  search+tag combination, cross-team 404.
- e2e-visual.mjs 22/22: tag editing through the UI, chips render, tag filter narrows
  the grid, status filter narrows to reviewed keys, reset restores. Screenshot inspected.
- Web unit 5/5; status/history 14/14; authz 28/28; integration 7/7; builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
