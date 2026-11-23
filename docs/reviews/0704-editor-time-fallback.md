# Guard editor discussion and history timestamps

## Developer
Guarded formatter replaces three template DatePipe usages for root comments,
replies and saved translation history. Valid short locale format retained. No
source normalization, sort, scope, mutation or refresh lifecycle changes.

## Product
Malformed metadata cannot hide loaded discussion or saved history values.
Unavailable labels do not verify authorship, history completeness or save state.
Explicit posting, deletion, local draft preservation and refresh stay unchanged.

## Designer
Actual desktop and390px screenshots inspected for comments/replies and history.
Fixed labels wrap with readable author/body/status/value context and reply
indentation, no horizontal overflow. Views are scrolled sections, not full editor.

## Security
No raw malformed time is exposed as labels or markup. No new requests, external
destinations, worker, permissions, secrets, token scopes, license or spend.
Fixtures remain isolated local database and deliberately changed read responses.

## QA and integration
- Ten new unit tests. Raw-label mutation failed exactly1 selected case, restored
  before274unique web files/3407tests green (136/1809 +138/1598).
- New actual local browser8/0: root/reply/history fallback, source content/status,
  explicit reread recovery, preserved unsent draft,390px fit and no mutations.
- Initial history test selected first history-row while comments remained open;
  scoped to containing history row and reran8/0. No application change needed.
- Existing comment refresh11/history refresh9/thread download11 =31/0.
- Web built/API cached, docs4/138routes, syntax/diff pass. Existing bundle warning
  persists. No whole-product/native/sync/external delivery acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
