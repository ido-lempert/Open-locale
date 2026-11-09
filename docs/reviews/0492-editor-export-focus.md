# 0492 Focused read-only exports

## Developer review
Three template-only mousedown handlers preserve focused translation on file,
bundle and TMX export. Shared download pending/generation/scope/error/URL
lifecycle remains unchanged. No API/storage/dependency change. Existing export
scope units cover captured locale/branch/format and pending/late responses.

## Product review
Explicit export should read saved values, not save a focused local translation
as a side effect. Each focused pointer export now performs one export GET and
zero translation writes, retaining focus/local value. Bundle remains all locales;
TMX remains selected target locale/project-wide memory, not branch translations.
No save/discard/import or automatic download on selection changes added.

## Design review
Actual desktop/390px pixels inspected: export controls, saved-only explanation,
confirmation and retained local translation readable. Existing labels/layout
unchanged. Keyboard behavior unchanged; pointer export keeps local input focus.

## Security review
No endpoint/auth/dependency/license/registration/spend/worker/credential change.
Existing authenticated export boundaries preserved. No unrelated translation
write before read-only download. Actual downloaded bytes and revoked object URL
checked, not only DOM success text.

## QA/integration review
Existing web1253in121/API265in31/builds0(APItest/buildcached). No new units for
three template events: new realbrowser8/0 initial+sweep exercises pointer events
against Angular/builtAPI/Postgres, all three exactlyoneGET/zerowrites/focus/local
value, filenames/revokedURLs/current saved bytes. File JSON compared parsed;
bundle/TMX exact baseline bytes, TMX targetHE with localEN focused.390px/runtime.
Intentional oldapp final4PASS4FAIL: all three focused zero-save checks fail plus
file bytes race exposes local draft. Initial3PASS3FAIL included fixture abort
exporting sourceEN TMX; correctedtargetHE/seededtarget beforeappfix and reran
oldapp discriminator. Both full logs retained. No post-fixfailure/abort.
AllAPI/119isolated browsers firstattempt0. Separate sync95+144=239unique/native
116+111+19=246total242unique/fourstartup repeats, each inner/outer0firstpass.
Config16/14/docs4-138routes/reaper4all0. Completed checks preserved across
continuations; staged/not uninterrupted. Coverage22FULL7PARTIAL1MISSING/
defaultOFF unchanged.
