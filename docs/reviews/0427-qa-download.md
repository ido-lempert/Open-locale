# 0427 Loaded QA findings download

## Developer review
Synchronous JSON serialization of current loaded findings and scope. Handler guards
loading/error/destruction, read start clears download feedback. Temporary object URL
revoked in finally; fixed download filename avoids arbitrary path/name input. Existing
QA generation/project fences and selectors unchanged.

## Product review
Offline review of exact currently loaded findings with schemaVersion/projectId/
branch/locale (null means all target locales) and issues. Empty successful reports
can download. Explicit loaded-only/private-text/not-sharing guidance; feedback says
requested, not saved/shared. No newer-server/live-draft/export history/delivery claim.

## Design review
Inspected actual loaded release/he and empty main/all-locales desktop pixels:
download control, loaded-only/privacy guidance and bounded feedback readable without
overlap; table scope remains clear. Existing narrow QA layout remains tested.

## Security review
JSON, not CSV/HTML/script execution; exact text roundtrip including hostile-looking
strings remains data. No new API/privilege/schema/worker/provider/account/credential/
license/spend changes or external sharing. Existing authorized finding read defines
file contents. Original owner upload scope/live target checked before push.

## QA/integration review
Unit6 exact quotes/newline/formula-like/Unicode JSON scope, cleanup, loading/error/
destroy guards, fixed failure feedback, reread clears feedback. API265/31 web730/59
builds0 initial444.16kB. Real browser6/0 twice reads downloaded bytes from disk matching
release/he API findings, zero account requests/writes on download, pending/failed read
and captured handler block stale export; empty main/all-locales scope correct. Initial
0PASS1FAIL fixture unsupported key punctuation rejected400; valid actual key seed
fixed, no app change. All API/isolated browsers final0; sync staged95/144239unique;
native separate116/111/19 (246total242unique/four repeats), inner/outer0. Final16/14/
docs4-138routes/reaper4 all0. No interrupted checks/canonical uninterrupted claim.
Checkpoints removed.22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
