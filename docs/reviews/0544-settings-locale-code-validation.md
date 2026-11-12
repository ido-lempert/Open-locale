# Settings locale-code syntax

## Developer review
Existing AddLocaleDTO regex on existing trimmed outgoing code. Remove native10
truncation; direct guard before busy/error/API. Busy direct guard prevents overlap
with pending Settings operation. Existing success clears code and reloads Settings;
existing valid failure keeps draft/error and releases busy, not editor unknownpause.
No backend/schema, other Settings mutations or access-control changes.

## Product review
Second add-locale entry point now exposes the API syntax rather than sending known
invalid text. Invalid raw text stays editable and correcting it needs no reload.
Not registry/uniqueness/availability/permission validation. Successful existing
Settings refresh is explicitly stated. No automatic repair, case change or submit.

## Design review
Linked rules/perfield aria-invalid/fixed correction/disabled Add. Actual desktop
and390px screenshots inspected: wrapped readable rules/correction, input and Add
fit page without horizontal overflow. Existing singleline input horizontally
scrolls long codes. No redesign of other Settings panels.

## Security review
Local preflight not replacement for serverDTO/authz. No token/security settings,
external request, worker, spend, registration, credentialscope or license change.
Existing valid-server-error presentation intentionally unchanged, no new privacy
claim. Local browser/API/Postgres only.

## QA review
27newunits:20actual-backend regex comparisons after trim,4invalid noAPI/reload/
state/error changes,correction exactlongcode, busyguard,existingvalidfailure.
Fullweb1876/168actualfirst0/API265/31cached0;buildwebactual/APIcached0.
Focusedfirst20/0. Initial oldapp attempt incomplete0PASS0FAIL at35s timeout awaiting
new-only button marker, reaperRC1 descendant cleanup did not settle; not accepted
as discriminator. Processes/socket checked clear. Fixture changed to wait existing
input then abort on failed first baseline assertion. Oldapp discriminator0PASS2FAIL
RC1; exact restored app20/0. No app fix following first20/0.
Real keyboard longcode retained,12invalid raw codes/directcall and Enter no read/
write, pendingduplicateguard,trimmedlongcode persists once and refreshes Settings,
valid409 preserves existingdraft/error without refresh.
APIa/b/c/d,sync-preview644,automations132,2fa37,SAML55 allfirst0;sync95+144=239
stagedfirst0. Native first116/0,middle27PASS7FAIL/incompleteRC1: initial Settings
locale noPOST then dependentlocale failures. Diagnostic verified legacy rename
readiness was busytrue: it only checked alreadytyped input, not completed rename.
Fixture waits busyfalse and verifies current API name before adding; appunchanged.
Secondnativefirst116/0,middle110PASS1FAILRC1 from introduced fixture verification
using undefined API/token variables inside caught try. Corrected verification to
page-authenticated GET. Thirdfirst116/0,middle111/0,tail19/0=246 staged, not an
uninterrupted pass. Originalfailure/diagnosticlogs retained. Config16/14,docs4,
harness3,reaper4first0. Browser170 latestRC0/1939PASS/zeroFAIL,168first.007first startupPG55700EADDRINUSE0PASS1FAIL
legacyRC0 rejected; /proc showed outgoing55700->3000TIME_WAITstate06/inode0,
directbind98;independent008/009 thenunchanged007second7/0.031firststartupPG55544
EADDRINUSE0PASS1FAILlegacyRC0 rejected;laterdirectbindOK/no proc row,originunknown;
independent032 thenunchanged031second16/0. No app/fixture fixes for collisions;
originalfailedlogs retained. Browser036-170 allfirst0. Final unit and build targets both cachedRC0;finaldocs4/0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance unchanged.
