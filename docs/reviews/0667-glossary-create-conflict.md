# Friendly glossary creation races

## Developer
Extracted the existing exact unique-index mapper into one private helper and applied it only around glossary create/update row writes. Update still calls it only for a term rename. Activity and transaction completion errors remain outside the catch. Normal duplicate prechecks, trimming, translation validation and functional database index are unchanged. Shared helper recognizes only observed GlossaryTerm P2002 metadata with projectId/lower(term) target; all other errors are rethrown.

## Product
A concurrent duplicate create now receives the same fixed409 as a duplicate detected before insert. The winning row remains intact; losing notes/translations and activity do not leak into it. Existing conservative unconfirmed-create UI behavior remains unchanged, including no automatic replay.

## Designer
No UI, layout or user-facing copy changes. Existing glossary create/recovery, draft and editor browser suites passed. No new screenshots or visual acceptance claimed.

## Security
Project authorization precedes lookup. Fixed errors reveal no private exception or constraint details. Shared mapping stays limited to the known unique index and row-write operation. Parameter-bound test SQL uses isolated local data. No new account access, permission scope, sharing or external service.

## QA and integration
- Focused create/rename units: 2 suites / 23 tests passed. New creation tests cover exact mapper, unrelated/null errors, activity error passthrough, trimmed data and authority-first behavior.
- Full API units: 33 suites / 288 tests passed.
- Real PostgreSQL/HTTP glossary suite expanded25 to29 checks. An uncommitted winning insert stays invisible to HTTP precheck; the test observes the losing INSERT's Lock wait, then commits winner. Verifies fixed409, exactly one winning row, no losing fields and unchanged activity.
- Negative probe removed only creation mapping. Exactly the new raced-create409 assertion failed,28 pass/1 fail, actual500, exit1. Source restored, rebuilt,29 checks passed. Rename race remains covered separately.
- All16 affected glossary browser suites passed,190 checks including editor14. Final API/web build passed. Docs consistency, script syntax and diff checks passed. No whole-product browser, web-unit, sync or native rerun claimed for backend-only scope.

Five review passes found no remaining issue. External-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING,disabled workers and unchosen license remain unchanged. No spend, registration or token-scope expansion.
