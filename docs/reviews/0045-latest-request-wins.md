# 0045 — Latest-request-wins on the tasks page

Review feedback (10:38) spotted that the filter-persistence diagnostic
described an application race, not only a test hazard: two filter-change
fetches fired back-to-back can resolve out of order, and the older
response would render over the newer selection during live use. The
reload path was already correct (a single fetch), so the bug only showed
during rapid live changes and project switches.

## What changed

- `TasksComponent.fetch` now stamps each request with a monotonic
  sequence number; only the newest sequence may write the task list,
  the error banner, or clear the loading flag. A stale success is
  dropped; a stale failure can no longer clobber a newer good state
  with an error banner.
- The component subscribes to `route.paramMap` instead of reading the
  snapshot once: the router reuses the component when only the project
  id changes, and each project now gets a full re-init - its own
  restored filters, cleared form/list state, and fresh
  tasks/members/groups/keys. Switching projects also invalidates every
  in-flight fetch from the previous project (sequence bump + per-call
  project-id capture on the aux lists).
- Application fix, not a test fix: the e2e races found earlier were in
  the suite's assertions; this change fixes the component behavior those
  races exposed.

## Review pass notes

- Developer: one counter covers tasks + banner + loading; aux lists are
  guarded by captured project id. No abort logic - the server requests
  are cheap and the guard is simpler than AbortController plumbing
  through ApiService. No new dependencies.
- PM: behavior now matches user intent - the list always reflects the
  last chosen filters, including after switching projects. Filter
  persistence stays per project (0042).
- Designer: no visual change; loading flag no longer flickers off early
  when a stale fetch finishes first.
- Security: none - client-side rendering correctness only; no new data
  exposure (stale data was same-project same-user data).
- QA/integration: two new unit tests resolve mocked responses in
  controlled reverse order (stale success and stale error both ignored;
  project switch re-inits with the new project's filters and ignores the
  old project's late response). One e2e check delays the DONE-filter
  response 2s at the network layer and confirms the newer all-status
  list survives its arrival. Unit-web 15 tests / 3 suites green;
  e2e-visual 127 checks.
