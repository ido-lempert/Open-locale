# 0423 Independent task option read recovery

## Developer review
Extracted members/groups/keys reads from project initialization into independent
methods with pending/destroy handler guards and per-source/project generation
fences. A project visit resets pending flags and starts fresh reads. Old results
cannot publish or clear new loading state. Retry does not reset form or task list.

## Product review
Failed option discovery no longer looks like genuine empty membership/groups/keys.
Each source has its own loading, fixed error and retry. Task reads/filtering and
available choices remain independent. No automatic polling, metadata completeness,
remote existence or mutation-validation bypass claim. Server authorization remains.

## Design review
Inspected failed/recovered desktop and recovered390px full-page screenshots:
alerts and three independent retry controls remain readable above the form;
retained draft and real key choices fit, no overlap/horizontal overflow. Existing
row wrapping remains. Clear distinction between unavailable options and no choices.

## Security review
Existing authenticated GETs only; fixed failure guidance never shows server text.
No new privilege/API/schema/worker/provider/account/credential/license/spend change.
Browser verifies no writes or sibling/task rereads during discovery retries. Original
owner upload scope and live target checked before push.

## QA/integration review
Unit5 source failures/retries/duplicate guards, retained form/selections/task list,
project stale results and destroy fence. API265/31 web714/55 builds0 initial442.76kB.
New real browser8/0 twice: all three option failures with persisted task available,
held assignee retry, failed+successful group retry, real member/group/key results,
retained draft/filter, GET-only independent reads, narrow fit. Existing Tasks31/0.
Initial4PASS1FAIL detached retry node while previous failure rerendered; subsequent
6PASS2FAIL assertions ran before success options rendered. Fixture waits for failed
HTTP response/settled alert and actual recovered options fixed both, no app change.
All API/isolated browser regressions final0. Sync staged95/144239unique; native
separate116/111/19,246total242unique/four repeats, all inner/outer0. Final config16/14,
docs4-138routes/reaper4 all0. No interrupted checks or uninterrupted canonical claim.
Checkpoints removed.22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
