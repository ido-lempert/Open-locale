# 0028 - Translation progress reporting (per locale, per branch)

## What shipped
- GET `/projects/:id/reports/progress?branch=` - per locale on one branch:
  `{ locale, base, total, translated, untranslated, percent, byStatus }`.
- Definition (stated in the UI next to the table, not only here): a translation
  counts as translated when its value is non-empty. `total` counts non-empty
  rows only in the status sum sense - `total = untranslated + sum(byStatus)`
  per locale; empty values and missing rows are untranslated and carry no status.
- `byStatus` covers every configured project status (including custom statuses),
  initialized to 0, plus statuses still present on rows after being removed from
  project configuration - removed statuses are reported, not silently dropped.
- Branch scoping: defaults to `main`; `?branch=` resolves by name, unknown
  branch returns 404. Numbers on one branch are independent of every other branch.
- Access: same rule as other read endpoints - session JWT member or read-scope
  API token; non-members 403/404, anonymous 401 (tested over real HTTP).
- Web: Progress page (`/projects/:id/reports`) with branch selector, per-locale
  progress bars and per-status columns; linked from the editor toolbar.
- OpenAPI: `/api/projects/{projectId}/reports/progress` documented; the
  docs-consistency suite still passes (67 routes both directions).

## Explicit limits
- Read-only aggregation; no caching layer, so numbers are computed per request
  (fine at current scale; revisit with large key counts).
- Percent is rounded to a whole number.
- No time-series/history view yet (status history exists per key; a trends
  report would be a separate slice).
- Counts are a point-in-time read; no snapshot consistency guarantee against
  concurrent edits mid-request beyond what Prisma's default read isolation gives.

## Review passes
- Developer: service + controller + module, Nx build green; suite reports-test.mjs
  (11 checks, real PostgreSQL + real HTTP).
- PM: definition of "translated" is stated in the product UI where the numbers
  are read, so a PM reading the table reads the same definition the code uses.
- Designer: progress bars + muted definition note; consistent with QA/branch UI.
- Security: member/token read access tested; no new write surface; no data
  beyond what the same principal could already read via the keys API.
- QA/integration: counts correctness, branch scoping/independence, custom
  statuses, empty-vs-missing rows, unknown branch 404, access matrix.
