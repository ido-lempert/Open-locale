# 0487 Safe focused history recovery reads

## Developer review
Dedicated retry requires current selected loaded key, a failed history read,
no pending history read, healthy key grid, no pending/unknown same-key deletion
and not departed. UI and captured handler share guard. Existing reader owns
locale aggregation and generation/departure fencing. Healthy refresh unchanged.
Pointer mousedown preserves focused translation. No API/storage/mutation change.

## Product review
Failed-history retry previously read history but could autosave an unrelated
focused translation through blur. Retry now reads only saved locale histories,
keeps local translations and never saves/restores a history entry. Failed read
still shows fixed error and no changes. At most50 newest returned changes,
separate locale reads, not complete history or one database snapshot.

## Design review
Actual final error-state desktop/390px pixels inspected. Retry, wrapped scope
and error readable; mobile translation input remains full-width and local value
retained. Pending retry disappears into loading status. Existing labels/layout
unchanged; healthy refresh remains separate.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured healthy/wrong-key/pending/unavailable/departed recovery refuses. Fixed
error omits backend private text. Existing authenticated reads unchanged; no
unrelated translation write on focused recovery.

## QA/integration review
11 new units/web1207 in117 suites/API265 in31/builds0 (final web/API cached).
Initial deferred-read unit did not settle both locales; review caught this and cleanup fixed
and all units rerun0. Intentional old-app discriminator1PASS2FAIL: focused retry
zero-autosave failed, then missing-new-handler abort. Full log retained. After
app guard/pointer fix, real browser6/0 initial and sweep: actual history503,
focused held retry only two locale GETs/zero writes/focus kept, captured duplicate
refusal, current actual saved history/local translation retained,390px.
All API/114 isolated browsers first-pass0 after fix; no post-fix failure/abort.
Separate sync95+144=239unique; native116+111+19=246total242unique/four repeated
startup checks, all inner/outer0 first pass. Config16/14/docs4-138routes/reaper4
all0. Completed results preserved across continuations; staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
