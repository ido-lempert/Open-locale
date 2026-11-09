# 0495 Safe focused local comment reply and cancel

## Developer review
Reply selection and cancel share current-thread readiness and require a loaded
key. Selection requires a root comment present in the current thread. Pointer
mousedown prevents unrelated translation blur-autosave. Post/delete and their
uncertain-write continuation are unchanged; no API or storage change.

## Product review
Reply and cancel change only the local reply target, make zero requests, and
retain translation value, comment draft and comment locale. They do not post,
delete, reload, save or retry. Unavailable thread/key state refuses both actions.

## Design review
Actual desktop and 390px screenshots inspected after the sweep. Focused local
translation, root author, reply target, cancel and full-width comment draft are
readable. Existing mobile stacking and scope selector are unchanged.

## Security review
Loading/error/saving/uncertain mutation, key loading/error/deleting/unknown
deletion, absent key, other thread and departed component refuse captured calls.
Missing/nested reply targets refuse selection. No endpoint/auth/dependency/
license/registration/spend/worker/credential change.

## QA/integration review
14 new units; web1283 in124/API265 in31/builds0(finalbuild/APIcached).
Initial full web1282PASS1FAIL: departed fixture expected a root after teardown
already cleared replyTo. Corrected to capture post-teardown state and assert
unchanged; full rerun0, first failure log retained. New browser6/0 initial+sweep:
actual stored root, focused pointer reply/cancel zero requests/no autosave,
local value/focus/comment draft/HE locale retained, unavailable-key captured
refusal, 390px and runtime. Intentional old-app2PASS2FAIL: focused zero-request
assertion then expected missing named cancel control abort; full log retained.
All API and122 isolated browser suites first-attempt0 after fix, no browser
failure/abort. Separate sync95+144=239unique/native116+111+19=246total,
242unique/four startup repeats, every stage inner/outer0 first attempt.
Config16/14/docs4-138routes/reaper4 all0. Completed checks preserved across
continuations; staged, not uninterrupted. Coverage22FULL7PARTIAL1MISSING and
defaultOFF unchanged.
