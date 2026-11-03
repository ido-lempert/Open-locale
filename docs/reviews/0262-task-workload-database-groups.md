# 0262 - Aggregate task workload in PostgreSQL

## Developer review
Group non-DONE tasks by effective user/group/null assignment in PostgreSQL, then
join names from users/groups. API receives assignment groups, not every task.
User-first normalization retained defensively; ordinary DB/API reject dual
assignment. Count converts to existing numeric contract. Stable kind/ID sorting
unchanged. No schema, route, auth or UI change.

## Product review
One count per open task, not per group member. Same-name identities remain
separate. Null remains unassigned; DONE and other-project tasks excluded. Names
remain mutable labels, not identity. Separate queries still not one DB snapshot.
Coverage22 FULL/7 PARTIAL/1 MISSING and repository worker defaultOFF unchanged.

## Designer review
Fresh existing actor/task fixture inspected at480x900: two distinct actor IDs,
group/user/unassigned rows and counts readable. Progress retains horizontal
scrolling. UI unchanged. Screenshot is not large workload/database aggregation
proof; actual PostgreSQL HTTP fixtures establish counts.

## Security review
Existing project authorization precedes bound SQL. Grouping occurs before joins,
so group membership cannot multiply tasks. User/group identities not merged by
name. Reduces task materialization, not DB CPU/memory/time bounds. No improved
snapshot freshness or authorization atomicity claim.

## QA/integration review
Reports48->50: realPG creates1501 extra user tasks plus one DONE and one other
project task. User count increases1501, group count unchanged, total increases1502,
open assignment sums reconcile, same identity bucket count. API261->262/31 unit
verifies query values/normalization SQL/scalar count conversion/no task findMany.
Web146/9 unchanged. Sync644/browser212,43 unique integration/config legs in13
fully completed green batches; individual,inner,outer RC0. Both builds/reaper4/
docs4/138routes green. Web562.75kBvs500 warning remains.
Native STAGED116+128=244 total/242 unique PG55534 inner/outer0,checkpoint removed.
Not uninterrupted. No app/test changes after native.

### Failures and recovery
- Initial realPG fixture attempted privileged dual assignment. Existing database
  tasks_single_assignee CHECK rejected INSERT after44PASS; suiteRC1, no assertion
  FAIL, reaper reported forced live-descendant cleanup. Changed fixture to legal
  user assignment;50checks green. Actual privileged dual-row proof NOT claimed.
- Combined B/C1/C2 call hit120s after B/C1 green and C2 first3legs green; incontext
  interrupted. Verified zombie postmaster/closed55467 before stale socket removal;
  reran full C2 under reaper, all inner/outer0.
- 2FA startup TCP55474 address-in-use: zeroPASS/RC1 rejected, no false green.
  Isolated2FA37 passed; mt/SAML reran in separate completedgreenbatch.
- No negative old-source control or measured performance benchmark claim.
