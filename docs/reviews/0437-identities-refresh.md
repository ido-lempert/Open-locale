# 0437 Explicit linked identity refresh

## Developer review
Expose existing guarded load from loaded, empty and error states. Pending/busy
button is disabled; handler independently rejects duplicate/destroyed/busy calls.
Existing generation fences and list/confirmation/password clearing retained.
No API/schema or unlink implementation changes. Formatting separates existing
compact code without changing valid unlink semantics.

## Product review
Current list can be reread without leaving the screen, including after successful
empty results or failure. Notice states confirmation and password are cleared.
Refresh never unlinks; provider email remains explicitly unverified metadata.
Password/session/API-token caveats remain unchanged.

## Design review
Actual desktop and 390px loaded-state pixels inspected. Refresh and notice fit;
long fixture issuer wraps without horizontal overflow. Independent link navigation
and unlink controls remain readable. Pending refresh has an explicit busy label.
Failure uses bounded existing guidance and the same refresh action.

## Security review
Refresh makes only the authorized account identity-list GET. It does not expose
password/provider configuration or submit DELETE. Old confirmation/password are
cleared before read; failed read cannot leave stale choices actionable. All
identity insert/delete fixtures were disposable local database records only.
Original upload authority and live named repository checked before push.

## QA/integration review
Three new units, eight in file; web776/67 API265/31 builds0. New browser7 real
API/Postgres with held socket proves one GET, draft/confirmation cleared,
new linked fixture appears, failed refresh clears stale rows, successful empty
recovery, refresh from empty, busy suppression and zero DELETE. Existing identity
guards7/link guards5/config retry11/normal local OIDC12/SAML55 all0. All API and
isolated browser regressions0. Sync separate95/144=239unique; native separate
116/111/19=246total242unique/four repeats, inner/outer0. Final configs16/14/docs4-
138routes/reaper4 all0, checkpoints gone. No failed/interrupted checks or canonical
uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
