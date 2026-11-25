# Glossary dynamic column structure

## Developer
Empty cell span uses locales length plus term/notes/actions, not fixed nine.
Four categories of heading have explicit col scope and Actions is named.
No handlers, data structures or save/blur/reset paths edited.

## Product
Empty glossary accurately spans its current translation columns. Actions has
visible heading on desktop, existing responsive card labels remain unchanged.
No extra locale reads, saves, recovery or filter reset.

## Designer
Inspected desktop table and390px card screenshot. Actions aligns with edit/
delete buttons. Mobile Term/he/Notes/Actions labels, translation field and
buttons fit without document overflow. No draft interaction changes.

## Security
No raw HTML, external effects, data/credential/provider changes. Unknown save/
delete state, literal metadata search and local drafts preserved. No worker,
license, spend, sharing or scope expansion.

## QA/integration
- Glossary17 web suites240 tests pass.
- Actual browser16/0: dynamic zero/one/three-locale empty span, all header
scopes/names, old fixed-nine negative detected/restored,390px card labels/fit,
existing typed metadata search/attention/draft/uncertainty/no read-write checks.
- Real backend glossary PostgreSQL integration passes.
- Production web build, docs4 checks/138routes, syntax/diff checks pass.
- Browser real API/PostgreSQL with local glossary signal fixtures. No whole-
product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING
and external acceptance gaps unchanged.

Five review perspectives complete; no scoped issue outstanding before commit.
