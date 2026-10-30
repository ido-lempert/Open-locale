# 0075 — Activity feed: filter by actor and by key

## Scope
Adds two filters to the per-project activity feed, on both the API and the web
activity page:

- **Actor filter** (`actorId` query param): exact match on the acting member's
  user id. Malformed (non-UUID) values are rejected with 400.
- **Key/target filter** (`key` query param): case-insensitive substring match
  on `keyName`, the snapshot column recorded at write time. Filtering by key
  therefore keeps working after the key itself is deleted — the log row
  retains the name it was written with.

Both combine with the existing `action`, `limit`, and `cursor` params.

## Why `keyName` rather than a key join
`Activity.keyName` is a denormalized snapshot: it survives key deletion, which
is exactly what a target filter on an audit log needs. A join to `Key` would
silently drop rows for deleted keys.

## API
- `GET /projects/:id/activity?actorId=<uuid>&key=<substr>` added to
  `ActivityController.list`; `actorId` validated as UUID (400 otherwise).
- `ActivityService.list()` applies `actorId` exact and
  `keyName: { contains, mode: 'insensitive' }` filters.

## Web
- Activity page gains an actor dropdown (populated from project members) and a
  key input with a 250ms debounce; both feed the same fetch and combine with
  the existing action filter.

## Verification
- `scripts/activity-test.mjs` +8 legs (32 PASS / 0 FAIL, RC=0): actor filter
  separates two acting members; unknown actor yields empty 200; malformed
  actorId yields 400; key filter is case-insensitive; no-match yields empty;
  action+key combine; a second member's actions on a fresh key are
  attributable after the first key is deleted.
- `scripts/e2e-visual.mjs` +3 legs (222 PASS / 0 FAIL, RC=0 at final HEAD):
  actor dropdown lists members including 'Demo User'; actor filter narrows
  rows; key filter `cart.checkout` narrows rows. Screenshot
  `editor-50-activity-filters.png` (OCR-inspected) shows both filters applied
  with only matching rows visible.

## Coverage note
Closes the audited PARTIAL "activity log filterable by actor and target" from
the 19 FULL / 10 PARTIAL / 1 MISSING baseline at bdf3807. No other coverage
item changes.
