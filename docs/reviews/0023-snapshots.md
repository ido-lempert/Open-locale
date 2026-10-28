# Review 0023 - Project snapshots (capture / auto pre-import / atomic restore)

## What landed

- `Snapshot` model + migration (JSONB keys/translations payload, cascade on project delete).
- `POST/GET /projects/:id/snapshots`, `POST /projects/:id/snapshots/:sid/restore`.
- Restore is point-in-time and atomic: keys absent from the snapshot are removed, the rest
  upserted, translations set to snapshot values+statuses, one transaction, history rows for
  every changed value, activity event committed with the data.
- Every import captures an automatic `before import <locale>` snapshot before mutating;
  automatic snapshots are pruned to the last 25 per project (manual never pruned).
- New webhook event `project.restored` delivered after commit (fire-and-forget; a delivery
  failure can never roll back a restore).
- Web UI: Snapshots page (list with auto badge + counts, create form, restore with confirm),
  editor nav link, activity labels.

## Review passes

- Developer: blank label 400; restore 404 for foreign/unknown snapshot ids; defensive skip of
  translations referencing keys missing from the snapshot.
- PM: matches plan "restorable auto snapshots"; per-language branching remains the open half
  of the plan item.
- Designer: page verified by headless-Chrome screenshot (list, badge, dates, restore buttons).
- Security: membership via getFor; read-only API token gets 403 on create/restore; no new
  egress; webhook payload carries counts and snapshot id only.
- QA/integration: scripts/snapshots-test.mjs - 23 checks on real PG + built API, incl. exact
  export equality after restore, deleted-key recovery, post-snapshot key removal, empty
  pre-import auto snapshot, history/activity rows, webhook delivery, scope checks.

## Restored scope (exact, verified)

Restore recovers: keys, their translations (value + status), and key metadata
(description, plural flag, maxLength, tags). Related data (comments, screenshot
links, translation history) survives intact for keys that still exist at restore
time, because those keys keep their ids. Keys deleted AFTER the snapshot are
recreated with new ids; their pre-delete comments/screenshots/history were
destroyed by the earlier delete cascade and are NOT recovered. Tasks carry no
key references and are unaffected. The web confirmation dialog states these
consequences before restore.

## Concurrency and retention (verified)

- Imports serialize per project via an in-process mutex, so an automatic
  snapshot always captures the authoritative pre-import state: 3 concurrent
  imports produce strictly-growing snapshot key counts and all keys land.
  A Postgres advisory-lock variant was tried and abandoned - lock-holding
  interactive transactions starved the Prisma pool (P2024, connection limit 3).
  Limitation: the mutex is single-instance; multi-instance deploys need a
  database-level lock with a dedicated connection.
- Retention: 26 rapid imports leave exactly 25 automatic snapshots; the manual
  snapshot is preserved.
- Cross-team: a second user's list and restore both return 404.

## Verified at this commit (exit 0)

snapshots 23, e2e-visual 40, imports 15, formats 24, webhooks 11, activity 24, apitokens 34,
docs-consistency 4 (53 documented = 53 implemented), api unit 31/31, nx build api + web.
