# 0452 Download local glossary draft backup

## Developer review
Explicit whitelist of all loaded local rows and new-term form, independent of
search. Readiness blocks initial/pending/failed read, pending create/save/delete
and destroyed handlers. Unconfirmed outcomes remain downloadable and are flagged
per row/form. Local edits/mutation/read start clear obsolete notice. Blob URL
released even if click fails. Pointerdown preserves input focus so backup click
does not trigger existing blur autosave; real focused-input browser check proves
zero API requests. Keyboard navigation retains existing normal blur behavior.
No API/schema/dependency change.

## Product review
Preserves text before recovery refresh without pretending to save it to server.
File states serverStateConfirmed:false and importable:false; includes private
notes/translations and pending-form text, not complete project/server history.
No automatic sharing, reads, restore or import. Initial/read failure refuses a
false empty backup; pending mutation asks user to copy text separately. Download
requested is not file-save or server confirmation.

## Design review
Initial 390px screenshot exposed pre-existing table squeeze, amplified by the
unconfirmed warning: translation input showed one character. Parent caught this;
fixed with component-scoped stacked rows below600px, visible term/locale/notes/
action labels and full-width inputs. Final desktop/390px pixels inspected and
sent: full local value and warning readable, desktop unchanged. Browser asserts
input width>=200px and no horizontal overflow.

## Security review
Explicit row/form whitelist excludes unknown API metadata. JSON preserves literal
markup/newlines/quotes as data. Unconfirmed save/delete/create states included as
facts about local uncertainty, never server confirmation. Download is local with
no API effects, new audience, external service, worker, spend or credential-scope
change. Owner upload authority and live remote state checked before push.

## QA/integration review
New unit11/web884 in82 suites/API265 in31/builds0. Dedicated browser10/0 at each
stage: exact local JSON/all rows despite search/new-term form, actual focused
input backup zero writes, real PostgreSQL save committed then dropped response,
explicit unknown flag/value, current recovery, held/failed reads, bounded local
failure and departed handler. Final run after mobile fix10/0; web units/build0
also after fix. All API/79 isolated browsers final0; API checks preceded CSS-only
mobile fix, browser sweeps after it except unrelated reports-refresh7/0.
Initial builds/API units inner0 but batch outer1 due Nx descendants; unchanged
reaped repeats all0. One nonexistent projects-browser script failed before test
startup; correct package entries all0. No assertion failures. Separate sync95+
144=239unique/native116+111+19=246total/242unique/four startup repeats, inner/outer0.
Config16/14/docs4-138routes/reaper4 all0. Completed results preserved across
continuation, no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF
unchanged.
