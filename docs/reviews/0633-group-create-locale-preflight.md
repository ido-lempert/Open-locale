# New-group loaded locale preflight

## Developer review
Requires a loaded project. Blank/whitespace-only remains valid; nonblank input
requires every comma segment nonempty and exact loaded code. Guard precedes
busy/error/receipt/invalidation/read/write changes. Existing name/role/create and
trim/duplicate payload semantics unchanged. Two older unit fixtures now use valid
loaded codes, retaining name boundary and pending draft cases.

## Product review
Closes silent widening of comma-only text to unrestricted empty-list group scope.
No member is added by group creation. Guidance states team-wide scope, direct/
other-group union and admin exception, loaded-state limits and server authority.
Explicit blank all-locales creation remains possible, not silently selected.

## Designer review
Persistent Group name/Group role/Group write locales labels plus Create group
heading, descriptive rules, aria-invalid and status feedback. Four final images
inspected20:33, readable and fitting390px. Lower text continues below mobile
viewport. Refused crops show preserved fields, global error above form not shown.

## Security review
Invalid Enter and captured handler produce zero reads/writes. Full raw name/role/
locale text, prior receipt/error and unrelated drafts remain. Real local API
restricted group plus separate explicit blank group verified, no members added;
403 retains saved groups and draft without refresh, loaded-code removal blocks.
No external access/account, API, worker, spending or credential-scope change.

## QA review
21 new unit cases, older pending/name fixtures adapted. Initial units actualweb
93s/APIcached exit0, build16s exit0. Focused first19PASS/0FAIL. Deliberate
always-valid-check negative9PASS/10FAIL exit1 includes invalid/no-effects and
consequent create assertions; restored19PASS/0FAIL. Pixels inspected20:33.
Broad all243 suites first-run0,2934PASS/0FAIL, each own call. All API groups
current green with initial integration bind-incomplete/retry retained below.
Sync239/native246/config/runner first-run0. Final units/build2/2 cached exit0,
docs4PASS, syntax/diff0. Publication awaits live exact-base check.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Reversible checkpoint, November 19 20:47
All API groups current green. Integration initial PostgreSQL55432 bind failed
before assertions; initial log retained. About70s later no matching process/socket
remained, unchanged same-port retry7PASS/0FAIL. All other API legs first-run0.
Sync239 first-run0 in95+144 staged checks, each own call; checkpoint removed.
Config16/14/docs4/glossary harness3 first-run0. Native246, runner harness4,
243 broad browser suites, final checks and publication remain. No active process,
credential file, lease or human blocker. Nine intended files remain uncommitted.

## Reversible checkpoint, November 19 21:20
Native246 first-run0 in116+111+19 stages on PostgreSQL56093, each own call;
checkpoint removed. Runner harness4 first-run0. Broad browser001-053 of243
first-run0, each own call, no exceptions or app/fixture edits. Logs retained.
Remaining054-243, final checks, final pixels/review closeout and publication.
No active process, credential file, lease or human blocker.

## Reversible checkpoint, November 19 21:53
Broad browser054-117 first-run0, each own call. Cumulative001-117 of243 green,
no broad exceptions or app/fixture edits. Completed logs retained. Remaining
118-243, final checks, final pixels/review closeout and publication. No active
process, credential file, lease or human blocker.

## Reversible checkpoint, November 19 22:25
Broad browser118-179 first-run0, each own call. Cumulative001-179 of243 green,
no broad exceptions or app/fixture edits. Completed logs retained. Remaining
180-243, final checks, final pixels/review closeout and publication. No active
process, credential file, lease or human blocker.

## Final five-pass closeout, November 19 22:58
Developer: exact-code/effect ordering inspected; name/role/create API payload
semantics unchanged, only two intentionally invalid older fixtures adapted.
Product: comma-only no longer silently creates all-locales scope; explicit blank
still allowed, no members added, team-wide and union/admin limits visible.
Designer: final four broad-run images inspected22:57, persistent labels and
heading readable at390px, lower text below mobile viewport; refusal global error
above crop, preserved fields visible. Security: discriminating negative control
and real persisted restricted/unrestricted groups prove scope behavior, invalid
handler/Enter zero effects,403 unchanged saved groups. QA: all staged/broad/final
checks above retained, including initial integration bind exception. No canonical
uninterrupted-run claim. Nine intended files only. No external account, worker,
spend, license, registration or credential-scope change.
