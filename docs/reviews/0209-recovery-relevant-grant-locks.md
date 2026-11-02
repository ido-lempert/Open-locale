# 0209 - Limit recovery locks to relevant admin grants

## Developer pass
Direct OWNER/ADMIN relies on already locked team membership,without querying groups.
Group-derived authorization queries only matching ADMIN grants,ordered by UUID and
locks role/grant rows. MEMBER groups cannot authorize recovery and are excluded.
Team membership remains mandatory. Multiple matching ADMIN grants conservatively
all lock;this is not minimum-single-grant selection.

## Product pass
Unrelated group edits no longer make recovery unavailable to an otherwise valid
direct/effective admin. Required group-derived grant contention still fails closed.
No public restore/token/history replay,repository effect composition,baseline advance
or remote writes. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Current actual480x900pixel screenshot inspected after browser test:
full UTC snapshot/not-live/refresh/no-reservation/no-restore notice,metadata/button
readable inside card. Upper summary partly under sticky header;full relevant card
visible. Local fixtures,not user/production data.

## Security pass
Direct-grant row stays locked and must be current. Group-only callers still require
matching ADMIN and locks on role/grant;existing revocation/team removal and55P03
required-grant tests retained. Actual unrelated MEMBER group locks and additional
ADMIN group lock do not block direct authorization. Per-lock2sec remains distinct
from total request bound. No external registration,credential scope expansion,spend,
license/audience or production changes.

## QA/integration pass
Initial sync464RC0 (462->464);additional direct-admin/ADMIN-group case brings465.
Negative control restores previous142guard:462pass/3expectedfail exactly irrelevant
MEMBER group contention for direct/effective admins and additional ADMIN group
contention for direct admin. Restored fix,final465RC0. Required group role/grant
contention tests still green. No unplanned failure,startup issue,timeout/interruption.

Final43integration/config legs14completed batches,individual/outerRC0. API248tests/
30suites,web65/7,both builds,reaper4RC0. Migration22,sync465,browser138,automation132,
webhook45,135routes. Native staged116+128=244total/242unique labels,all literal labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Negative-control
source restored byte-for-byte before final broad verification,no later app edits.
Only review added afterward.
