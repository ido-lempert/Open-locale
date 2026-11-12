# New-project local preflight

## Developer review
Rawname nonblank existingguard plus backend max120 count. Exact backend slug
regex /^[a-z0-9][a-z0-9-]{1,60}$/; replace weaker native pattern with local check.
At least one existing split/trim/filter locale entry before state/API. Name/slug
outgoing bytes remain raw, not trimmed; locale parsing unchanged. No syntax or
uniqueness validation added. Existing receipt/newerwholeform/list/unknownpause
unchanged. No backend/schema/security settings change.

## Product review
Known invalid form stays editable, no avoidable unconfirmed-create pause. Local
name/slug/locale-entry guidance explicitly disclaims syntax/uniqueness/availability.
Comma-only locale text no longer sends empty array. No autocreate/truncate/repair.
Backup/discard/recovery independent. Valid server failures remain unconfirmed.

## Design review
Shared linked rules, perfield aria-invalid, fixed correction, disabled New project.
Actual desktop/390px screenshots inspected: readable wrapped guidance/correction
and no overflow. Existing one-line fields scroll horizontally, not redesigned.

## Security review
Client check not serverDTO/authz replacement. Literal markup names stay text;
fixed failure hides private message. No secret/security setting touched; localPG
only; no external account/worker/spend/credentialscope/license changes.

## QA review
37newunits:12actual-backend rawname count comparisons plus existing nonblankguard,
13actual-backend slugregex comparisons including trailing newline,5localeparse,
5wholeinvalid/noAPI/list/pause/rawform,correction/exactrawname/parsedlocales,
validfailurepause. Fullweb1832/166actualfirst0/API265/31cached0;buildwebactual/
APIcached0. Focusedfirst12/0,oldapp0PASS2FAILtimeoutabortRC1,restoredfinal12/0.
RealPG keyboardname121 retained,invalidEnter/directcall noPOSTGET,rawUnicode120
persists once without trim,parsedcodes kept,trailingdashslug accepted,literal
markup,valid503pause/noreplay/private. Broad168browser latest1908PASS/zeroFAIL/RC0,166first.065 first0PASS1FAIL/
startupRC1 PG55786EADDRINUSE. Later directbindOK/no local proc socket; cause of
collision unknown. Independent066 first6/0 then unchanged065 second8/0. No fix.
130 first5PASS/0FAIL incomplete at outer120s timeout while awaiting held request;
no terminal result. Specific leftover Nx/Chrome groups cleaned. Diagnostic first
startup0PASS1FAIL stale UnixPG55819lock, legacy script exit0 rejected as evidence.
Lock owner zombie/TCPbindOK verified before stale lock/socket removal. Bounded5s
held-request diagnostic10/0 then restored exact unchanged second10/0. Initial
hang cause unknown, no app/fixture fix; original partial/diagnostic logs retained.
AllAPI legs first0;stagedsync239/native246 first0,not uninterrupted;config16/14/
docs4/harness3/reaper4 first0. Finalunits/buildbothcached0. No executable change
between focused validation and broad/final checks. Coverage22FULL7PARTIAL1MISSING/
defaultOFF and external acceptance gaps unchanged.
