# Review 0002 — Authorization baseline (security priority pass)

Triggered before any public/service exposure of the API. Distinction this pass cements:

- **Baseline (enforced now):** team/ownership authorization. Every protected route resolves
  the caller (JWT or `ol_` API token) to a user, resolves that user's team memberships, and
  scopes every project/key/translation/import/export query through
  `ProjectsService.getFor(userId, projectId)` (`teamId IN caller's teams`, else 404).
  Key-level routes additionally verify the key belongs to the project in the URL.
- **Deferred (Phase 2):** fine-grained token scopes (read-only tokens, per-project tokens,
  write-limited tokens). This narrows what one credential may do *inside* the teams the user
  already belongs to. It is a refinement, never a substitute for the baseline above.

## Evidence (scripts/authz-http-test.mjs, real PostgreSQL + real HTTP)

19 checks, all passing:

- Unauthenticated: no header, garbage Bearer, garbage `ol_` key → 401 (3 checks).
- Isolation: user B's project list excludes user A's project (1 check).
- Cross-team denial (404) on all 12 route families: project get/patch/delete, locale
  add/remove, key list/create/update/delete, translation upsert, JSON export, JSON import.
- Foreign key id against B's own project → 404 (1 check).
- A's data verified intact after B's attempts (name, translation value, locales) (1 check).

## Findings

None open. No code change was required: ownership scoping was already enforced centrally.
The pass adds the executable proof and the npm scripts `test:integration` and `test:authz`.
