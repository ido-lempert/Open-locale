# Review 0003 — Translation editor v1 (web UI)

Scope: Angular editor v1 - login/signup, project list + create, keys/translations grid
with autosave, locale add, JSON import/export, search, RTL-aware cells, mobile layout.

## Pass 1 - Developer
- Finding: search input fired one API request per keystroke. Fixed: 250 ms debounce.
- Finding: save-in-flight race if a cell is edited during its own save. Recorded, deferred
  to editor v2 (per-cell request sequencing); impact limited to a redundant later save.
- Templates rely on Angular interpolation escaping; no innerHTML anywhere. Clean.

## Pass 2 - Product manager
- Present: empty states, key count, autosave feedback per cell, import result notice,
  RTL input direction, JSON download naming (`<slug>.<locale>.json`).
- Deferred (recorded in PLAN): project settings screen (rename/delete project, change base
  locale) and API token management UI - both next increments, not part of editor v1 scope.

## Pass 3 - Designer
- Finding: long key names could overflow their column. Fixed: overflow-wrap anywhere.
- Finding: no visible keyboard focus indicator. Fixed: :focus-visible accent outline.
- Verified: sticky header, mobile stacking below 760px, consistent spacing scale. Clean.

## Pass 4 - Security researcher
- Finding: JWT stored in localStorage (readable by any injected script). Accepted tradeoff
  for v1 SPA; recorded deferral to Phase 2 (httpOnly cookie session). No secrets in the
  repo; dev proxy targets localhost only; API requires auth on every route (0002 proof).
- Large JSON imports hit the API body-size limit with a clean 413; noted.

## Pass 5 - QA / integration (rerun with browser e2e)
- nx build web: success. nx test web: 3/3 (router outlet shell, login tabs, project list
  rendering with mocked API). API suites unchanged: 5/5 unit, 7/7 integration, 19/19 authz.
- scripts/e2e-visual.mjs (puppeteer-core + headless Chrome + real PostgreSQL + real API +
  real dev server): drives signup -> project creation -> key creation -> bilingual
  translation entry -> reload persistence. 9/9 checks PASS. Screenshots archived.
- REAL DEFECT FOUND by e2e (fixed in the follow-up commit): the app is zoneless
  (no zone.js), and the editor kept cell state in a plain Map and form fields in plain
  ngModel properties. Async autosave completions never re-rendered ("saving..." stuck
  although the write landed), and programmatically cleared inputs kept stale text.
  Fix: cell state and all form fields converted to Angular signals.
  This also resolves the Pass 1 save-in-flight race: a save now reconciles against the
  latest signal value, and an edit during save returns the cell to idle so the next
  blur persists the newest text.

All findings fixed or explicitly deferred with phase. Clean rerun achieved.
