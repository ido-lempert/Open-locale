# 0434 Linked identity current-handler guards

## Developer review
Explicit destroyed fence for choose/cancel/load/unlink. Choose/unlink require
successful loaded list and current identity id; unlink still requires selected
id/password/not busy. Load suppresses pending duplicates while allowing initial
loading=true state. Existing generation guard ignores late responses. No API change.

## Product review
No new identity operation. Existing explicit password confirmation/session revoke/
API-token-not-revoked guidance and valid current unlink behavior preserved. Stale
captured references cannot initiate unlink or reopen departed account UI.

## Design review
Actual desktop/390px current confirmation pixels inspected. Existing form,
password masking, explicit unlink/signout/Cancel and metadata caveats readable
without overlap. No UI layout changed. Evidence transferred.

## Security review
No real identity/provider/credential/access changes. Disposable local fixtures
only. Handler fences are defense in depth; server authentication/ownership/password
checks remain unchanged. No authority claim added by client loaded-list check.
Original upload authority and live target/baseline checked before push.

## QA/integration review
Unit5 pending/error/unlisted/destroy/duplicate/late-result/valid-success controls.
Browser7 held realGET suppresses duplicate/stale selection/unlink; unlisted choice
cannot open confirmation; destroy captured handlers issue no GET/DELETE; real
binding/session preserved; valid local-test unlink deletes exact binding/signsout.
API265/31 web764/66 builds0 initial444.16kB. All API/isolated browser regressions0;
sync separate95/144239unique, native116/111/19 (246total242unique/four repeats),
inner/outer0. Final16/14/docs4-138routes/reaper4 all0. No failed/interrupted checks
or canonical uninterrupted claim. Checkpoints removed. Coverage22FULL7PARTIAL/
1MISSING/defaultOFF/external acceptance unchanged.
