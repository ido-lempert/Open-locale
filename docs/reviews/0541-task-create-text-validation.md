# Local new-task text limits

## Developer review
Existing outgoing title/description trim and optional blank-description omission
retained. Title1-200/description0-2000 matches installed class-validator/validator
isLength surrogate/presentation-pair count, not UTF16/graphemes. Remove native
maxlength200 truncation. Guard before reset/download/list/mutation/create state.
Existing full-draft newer-edit check, scoped create receipt, post-create fetch and
valid-failure unknown pause unchanged. No API/schema change.

## Product review
Known invalid title/description stays editable without a failed request or
unconfirmed-create pause. Raw text, date, IDs and lock choice retained. Only text
limits checked, not dates, ID availability, assignment, lock permission or key
count. Backup/discard/recovery remain independent. No repair/truncate/autocreate.

## Design review
Linked rules, per-field aria-invalid, fixed correction and disabled Create task.
Actual desktop and390px screenshots inspected: wrapped readable guidance and
correction fit; mobile capture scrolls to guidance below full form. Existing
one-line inputs horizontally scroll long text. No compact/multiline redesign.

## Security review
Client check not DTO/authz replacement. Literal markup title remains text, fixed
failure message hides private error. No external provider/account/worker/spend/
credential-scope/license changes. Test uses real localAPI/Postgres.

## QA review
29newunits:22actual-backend comparisons,4invalid full-form noAPI/fetch/pause plus
retained date/assignee/predecessor/keys/lock choices,correction/trim,optionalblank,
valid failure pause. First fullweb1793PASS2FAIL/165 from copied fixture expecting
no assignment fields; actual existing assigneePatch emits explicit nulls. Fixed
only expected payload; second1795/165actual0,API265/31cached0. Buildwebactual/
APIcached0. Focused first11/0,oldapp0PASS2FAIL(timeoutabortRC1),restoredfinal11/0.
RealPG actualkeyboardtitle201 retained,invalidEnter/capturedcreate noPOSTGETPATCH,
Unicode200/presentation2000 persist once with trim/due date and existing task
retained,blank description omitted,literal markup,valid503pause/noreplay/private.
Broad167browser latest1896PASS/zeroFAIL/RC0,166first. AllAPI legs first0;
stagedsync239/native246 first0, not uninterrupted. Config16/14/docs4/harness3/
reaper4 first0. Finalunits and build bothcached0. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.

Broad browser022 tasks first11PASS/1FAIL timeout held-create indicator. Diagnostic
reproduced: enabled valid Create recty67-100 hit sticky-header status select;
postclick focus select/creatingfalse/titlevalidtrue. Fixture center-scrolls submit
before pointer clicks; unchanged app second31/0. First/diagnostic logs retained.
Other166 suites first0. No further app or fixture changes during sweep.
