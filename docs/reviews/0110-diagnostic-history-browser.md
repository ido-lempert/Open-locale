# 0110 - Read-only diagnostic history screen

## Developer pass
Add history route linked from file preview, typed API list call, bounded
record cards. Loading/error/empty states and refresh. Subscribe to project
route changes, clear old records immediately, generation-guard responses and
unsubscribe on destroy. No new persistence or mutation UI.

## Product pass
History explicitly says diagnostic, not successful sync or accepted baseline;
caller-file SHA/provenance unverified and no apply action. Explain latest50,
retained100, explicit API-only creation and ordinary comparison no-save.
No connected provider, credential setup, actual baseline or sync acceptance.

## Designer pass
Inspected actual desktop and 480px history screenshots. Card spacing, amber
warning, wrapping fingerprints and title readable without document overflow.
Fixed singular record/conflict labels after visual review. No hidden actions;
back link returns to preview. Dates use viewer's locale/timezone display.

## Security pass
Text interpolation only for metadata. No file values returned or displayed;
no credential data. Existing server session/admin requirement controls access,
member error shows no cards. Same-component project navigation verified clears
prior project records. Read-only screen does not grant mutation authority.

## QA/integration pass
Real browser suite19->26 checks. Click through preview link to empty history,
explicit API-created record after refresh, counts/fingerprint but no raw file
values, no apply action,480px overflow/wrapping, reused project route clearing,
member denial no record. Existing compare and browser isolation checks retained.
Initial browser run all26 pass; singular text cleanup during visual review
rerun before commit. Broad visual and full sweep at final HEAD before push.
