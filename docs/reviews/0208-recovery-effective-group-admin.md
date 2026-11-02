# 0208 - Internal recovery effective group admin

## Developer pass
Internal recovery keeps team membership as outer boundary,then reads effective group
ADMIN grants with deterministic group UUID order and FOR UPDATE OF group/grant rows.
Direct OWNER/ADMIN remains accepted. Same Serializable transaction/per-lock2sec
bound. No new execution caller,route or schema change.

## Product pass
Aligns internal recovery guard with existing effective group-admin policy used by
eligibility. Group role/grant revocation and removed team member deny recovery.
No public restore/token/history replay,repository effect composition,baseline advance
or remote writes. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Current actual480x900pixel screenshot inspected after browser test:
full UTC snapshot/not-live/refresh/no-reservation/no-restore notice,metadata/button
readable inside card. Upper summary partly under sticky header;full relevant card
visible. Local fixtures,not user/production data.

## Security pass
Locking group rows and matching grant rows prevents validated role/grant replacement
under a recovery write;Serializable failures must not retry stale authority. Current
team row is still required even if stale group rows survive. Actual group-role and
group-grant contention returns55P03,recovers after release. Lock timeout is per-lock,
not total request bound. No external registration,credential scope expansion,spend,
license/audience or production changes.

## QA/integration pass
Initial sync460RC0 (453->460). Added actual group-admin writer actor/unverified-value
and rollback tests yields462. Negative control removes FOR UPDATE OF group/grant:
460pass/2expectedfail exactly actual contention assertions. Restored fix,final462RC0.
Group admin positive,role demotion,grant removal,team removal and released-lock
recovery covered with real PostgreSQL transactions. No unplanned failure,startup
issue,timeout or interruption142.

Final43integration/config legs14completed batches,individual/outerRC0. API248tests/
30suites,web65/7,both builds,reaper4RC0. Migration22,sync462,browser138,automation132,
webhook45,135routes. Native staged116+128=244total/242unique labels,all literal labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Negative-control
source restored byte-for-byte before final broad verification,no later app edits.
Only review added afterward.
