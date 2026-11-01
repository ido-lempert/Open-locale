# 0206 - Authorize recovery eligibility within diagnostic snapshot

## Developer pass
ProjectsService member lookup accepts an optional transaction client;existing callers
keep their ordinary client. New requireAdminInTransaction reuses the same effective
direct/group role semantics. Recovery preview retains preflight and rechecks inside
its RepeatableRead diagnostic before reading eligibility. No duplicated role policy.

## Product pass
Committed demotion/removal after successful preflight but before diagnostic snapshot
now denies the preview. Direct admin and effective group admin remain supported.
Snapshot started before revocation retains snapshot semantics;this is not continuous
authorization or reservation. No restore mutation/token/history replay,repository
effect composition,baseline advance or remote writes. Coverage unchanged at
22FULL/7PARTIAL/1MISSING/defaultOFF.

## Designer pass
No UI change. Inspected current actual480x900pixel screenshot after browser run:
UTC snapshot/not-live/refresh/no-reservation/no-restore notice,metadata/button readable
inside card. Upper summary partly under sticky header;full relevant card visible.
Local fixtures,not user/production data.

## Security pass
Read-only eligibility authorization and data now share a RepeatableRead snapshot.
Team membership remains outer boundary;group ADMIN preserves effective access while
committed removal denies it. Removed direct member returns404,demoted direct member
or removed effective group grant403. Existing session/no-store/public whitelist
checks remain. No extra external registration,credential scope,spend,license/audience
or production changes. Other read routes were not changed in this bounded slice.

## QA/integration pass
Sync443->448 adds actual PostgreSQL committed interleavings for direct demotion,
direct removal,group grant removal after preflight,plus positive direct/group admin.
Negative control omitted in-snapshot auth:445pass/3expectedfail exactly the three
revocation cases. Restored fix;final448RC0. Initial API build failed because a broad
edit touched unrelated group methods;reverted those substitutions,fixed buildRC0.
Initial448 used old dist plus freshly bundled service,not final whole-app evidence.
Final broad sweep uses fixed API build. No timeouts/interrupted calls140.

Final43integration/config legs14completed batches,individual and outerRC0. API248tests/
30suites,web65/7,both builds,reaper4RC0. Migration22,sync448,browser138,automation132,
webhook45,135routes. Native staged116+128=244total/242unique labels,all literal labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Negative-control
source restored byte-for-byte before final broad verification. Only docs/review
added afterward;no app edits after restoration.
