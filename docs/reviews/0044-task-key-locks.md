# 0044 — Task key locks

A task can lock a set of keys: while the task is not DONE, only its
assignee (direct member or anyone in the assigned group) or a team
ADMIN/OWNER can edit those keys' translations. Second half of the
capability map's "tasks with locks and chaining".

## What changed

- `tasks.lockKeys` flag + `task_keys(taskId, keyId)` join table
  (migration `20261029085000_task_key_locks`), both FKs ON DELETE
  CASCADE, index on keyId.
- API: task create/update accept `lockKeys` and `keyIds` (update
  replaces the set when provided). Key ids must belong to the task's
  project (400). Responses include `keys [{ key { id, name } }]`;
  task.updated audit events record lock flag and locked-key-set
  changes (key names, capped at 5).
- Enforcement: `TasksService.assertKeysEditable` runs in the
  translation write paths - single-cell upsert, single status change,
  and bulk status commit (throws inside the transaction, so a bulk
  move touching a locked key rolls back completely). 403 message names
  the locking task.
- Enforcement scope (grounded by grepping every translation write in
  the API): editor upsert (also covers TM-suggestion applies), single
  status change, bulk status (whole bulk rolls back), file imports
  (intentionally per-key: a locked key fails its own transaction, the
  run row records the failure, the rest of the file imports), MT
  pre-translate (whole run rejected), branch merge (guarded at the
  first actual write per key - a merge whose rows for a locked key are
  all no-ops is not denied; a denial rolls the whole merge back
  atomically), snapshot restore (locked keys about to be DELETED are
  guarded before anything is touched, writes guarded per actual
  change; one transaction, atomic rollback), and key deletion.
- Serialization: the guard takes `pg_advisory_xact_lock_shared` on
  `hashtext(projectId || '::task-locks')` inside the writer's own
  transaction; task create/update/remove take the exclusive side when
  they create, change or release a lock (flag, key set, status of a
  locking task, deletion). A lock committed concurrently with a write
  is therefore never missed after both settle: either the write
  committed first (valid ordering, not retroactively cancelled) or it
  is denied. Lock ordering against the dependency-graph lock is fixed:
  graphLock always precedes lockMutationLock, and no path takes them
  in the opposite order (verified by inspection of the two sites that
  can hold both, create and update).
- No ghost locks: `task_keys` rows cascade on task delete and on key
  delete, and a DONE task no longer matches the guard query (all three
  release paths tested).
- Tasks UI: new-task form gains a key multi-select plus a
  "lock the selected keys while this task is open" checkbox; rows show
  a "locks N key(s): a, b, c, …" chip. The editor surfaces a rejected
  save through the existing per-cell "save failed" status.

## Review pass notes

- Developer: the guard is one indexed findFirst over task_keys keyed
  by projectId + keyId; no N+1 on the bulk path (single call with the
  updated key set, before commit, same request transaction boundary).
  Create/update re-read the task after mutating key rows so responses
  never show a stale key list.
- PM: DONE releases the lock and reopening re-applies it, matching how
  the chaining gate treats status. Deleting the task releases its keys
  (cascade). An open lock task with an empty key set locks nothing.
- Designer: the multi-select reuses the form's existing select
  styling; the chip is a muted line consistent with "waits on". A
  scope note under the toggle states exactly what a lock blocks and
  for whom. A rejected editor save keeps the unsaved text and shows
  the server's reason under "save failed - retry", so the user can
  resolve the cause instead of blind-retrying. Single selects keep
  their own height next to the multi-select at 480px (flex alignment
  fix, e2e height assertion).
- Security: cross-project key ids rejected (400); a non-assignee
  MEMBER gets 403 naming the task (no key content leaks); group
  membership changes take effect on the next request (live query, no
  cached grant); ADMIN/OWNER override is explicit and matches the
  existing admin-bypass convention. Lock state is checked at request
  time; a lock created concurrently with an in-flight bulk write can
  be missed by that write (accepted check-then-act limit, same class
  as the other permission checks).
- QA/integration: tasks-test.mjs +25 checks (adds MT 403/200, import
  per-key failure with locked value untouched, key delete 403/200,
  lock-vs-write race with post-settle denial) (create, non-assignee
  403, assignee 200, status 403, bulk 403 + rollback probe, group
  member 200, group leave immediate 403, owner override 200, set
  empty/re-add, audit event, DONE release, reopen re-lock,
  cross-project 400, delete release). e2e-visual +5 checks (UI create
  with chip, narrow viewport, member editor save failed, DONE release
  save).
