# Review 0005 - API token management + header/resilience hardening

Scope: token create/list/revoke (settings UI + API), read/write scope enforcement for
ol_ tokens, narrow-viewport header fix, input preservation against late async resets,
locale-removal confirmation that names the lost data.

## Pass 1 - Developer
- Token list never returns tokenHash or raw values (proven by authz check); the raw
  token is returned exactly once at creation.
- Scope enforcement lives in JwtAuthGuard: an api-token principal without "write" gets
  403 on any non-GET/HEAD/OPTIONS route. JWT sessions are unaffected.
- Input preservation: add-key/add-locale/create-project/create-token clear their field
  only if the value is unchanged since submit - a fast typist, paste or autofill that
  lands mid-request is never wiped by the late response. Unit-tested with a deferred
  mock promise (deterministic, no timing dependency).

## Pass 2 - Product manager
- Create form offers read-only vs read+write - and unlike the earlier deferral, scopes
  are now actually enforced, so the choice is honest.
- Token rows show scope, creation date and last-used date ("never used" otherwise).
- Locale removal now states the consequence before acting: "Remove he? This permanently
  deletes its N translations." - counted live from project keys.

## Pass 3 - Designer
- Reviewer feedback: at 390px the editor header wrapped awkwardly ("2 keys" at the edge).
  Fixed: title gets flex min-width 0 + ellipsis, meta stays nowrap, header wraps whole
  items, tighter padding under 420px. Re-inspected at 320x700: wraps cleanly in two rows.
- Token reveal is a distinct notice block with an explicit Copy action.

## Pass 4 - Security researcher
- Revocation is confirm-gated naming the token and its immediate effect; it takes effect
  on the next request (proven: revoked token -> 401).
- Cross-user token revocation denied 404 (authz suite). Read-only token cannot create
  keys (403) but can read (200). Invalid scope sets rejected 400.
- Token list/revoke resolve through the caller principal; no user-id parameters accepted.

## Pass 5 - QA / integration
- authz-http-test.mjs: 28/28 (adds token create/list/revoke, read-only 403, revoked 401,
  cross-user list isolation and revoke denial).
- e2e-visual.mjs: 17/17, adding the full UI token journey (create read-only, reveal once,
  GET 200 / POST 403 via X-Api-Key, two-click revoke, 401 after) and 320px capture.
- Web unit 4/4 (adds the input-preservation test). Builds green.
- Chronology honesty: two transient test-side timeouts during development (locale-add
  wait raced a re-render once; mobile block navigated from the wrong page after the
  token section was inserted) - both fixed in the driver, no app changes needed.

All findings fixed. Clean rerun achieved.
