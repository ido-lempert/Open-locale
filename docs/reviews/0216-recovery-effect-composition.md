# 0216 - Isolated recovery and repository effect composition

## Developer pass
New internal Serializable composition captures primitive scopes before awaits,
locks current repository target/baseline and recovery bindings,checks locale and
actual branch name,admits queue budget,then creates fresh row/history/TM/activity,
removes absence marker,and inserts one generation-bound set-value intent in the
same transaction. No upsert/no archived history replay. Reuses existing guards and
writer. Corrected initial rowId unique-selector error to actual composite key.

## Product pass
Closes an internal composition gap,not public restore execution. No HTTP caller,
restore UI,fresh GitHub fetch,worker enablement,baseline advance or remote write.
Current repository guard intentionally requires direct team admin;group-derived
recovery alone remains supported,but not this composition. Existing pending workers
could process an intent if a future caller creates one and explicitly enables the
worker. DefaultOFF remains. Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Current actual480x900 focused-review screenshot inspected:full first
card,blue focused region outline,escaped markup,readableUTC/read-only/no-reservation/
no-restore notice and hide/check buttons,no overflow. Second card continues below
viewport. Local fixture only.

## Security pass
Project/actor/branch/locale,target revision,baseline and stale recovery mismatches
fail atomically. Queue admission occurs before mutation. Actual byte/count budget
fixtures reach backlog rejection. Negative control removing admission initially
committed fixture recovery and caused downstream stale-candidate abort;explicit
rollback sentinel now keeps both negative legs independent. Strengthened control:
510pass/2expectedfail. Restored exact fixed source:512passRC0. Intent binding is
canonical recovery lineage,not a repository comparison preview;existing generic
schema digest fields are reused,not an execution grant. Actual eligibility guard
accepts resulting row generation. No secrets/accounts/spend/license changes.

## QA/integration pass
Sync495->512 (+17). Actual committed fresh row/one pending intent/repeat-no-duplicate,
unchanged baseline/no repository calls. Injected post-write intent insertion fault
rolls back row/history/TM/activity/marker. Isolated writer tests retained.
Initial build/runtime failed on nonunique rowId selector;fixed app and fixture.
Count-budget fixture initially violated non-null set-value constraint;fixed to
empty text. Corrected/final512green;no app changes after final source restoration.

All43 unique integration/config legs passed,including migration22,browser151,
automation132,webhook45 and136OpenAPI routes. IndividualRC0 and completed final
batch/standalone outerRC0. API248/30,web74/7,both builds,reaper4RC0. Oversized combined
shell batches hit120s repeatedly. Partial batches are not green outer runs;affected
legs rerun separately/narrowly. Interrupted incontext-edit,OIDC,sync-browser and
automation left stale PostgreSQL socket locks;confirmed dead processes,cleaned and
reran successfully. Sync-browser startup stale socket printedFAIL with toolRC0;
outer wrapper rejected it,final151RC0. No false-green claim for that attempt.

Native staged116+128=244total/242unique,all literal labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. Current source includes new isolated
helper but no production caller. No production or external acceptance claim.
