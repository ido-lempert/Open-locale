# Explicit direct member role Save

## Developer review
Per-member role selection stays local. Save snapshots chosen role; pending guard
covers PATCH and reload, blocks duplicate direct calls. Clear only unchanged
draft, retain newer choice. Reflect accepted role locally after success before
reload so refresh failure does not disable an explicit newer revert. Maps retain
other member keys. Existing request path/body and server rank checks unchanged.

## Product review
Selecting a direct team role must not itself grant access. Explicit Save role
and direct-role/group-union help separate draft from effect. Receipt distinguishes
saved submission from unsaved newer selection. No automatic second PATCH. A group
can still supply inherited admin after direct demotion, verified in actual PG
fixture and existing effective-grant note. Refusal keeps choice, no saved claim.

## Design review
Actual role badge separate from role draft; Save disabled unchanged/empty/invalid/
pending. Saving role label while pending; dropdown remains editable. Button
explicit type=button, selector attr.name stable with ngModel. Desktop1278x899/
mobile390x844 pixels inspected: ADMIN badge, newer MEMBER dropdown, Save/help/full
receipt readable, no horizontal overflow. Mobile member name above viewport.

## Security review
No backend/permission/default/worker change. Existing isTeamAdmin/nonOWNER controls
and server checks authoritative. UI validity/duplicate guard is not authorization.
Only disposable local DB demo membership/group grant exercised, no actual account
grant changed. No external request, credential change, registration, spend or
license change. Fixed receipt avoids user HTML. Group union remains unchanged.

## QA review
12newunits. FirstfullRC1 copy adaptation referenced g instead of m; fixed guard
and aligned template method name, correctedfullwebactual/APIcachedRC0. Build
webactual/APIcachedRC0. Firstfocused2PASS/1FAILRC1 duplicate-call fixture referenced
old group variable. Corrected it; planned inherited-note assertion moved to after
direct demotion because note legitimately disappears for directADMIN. Corrected
11/0RC0. Isolatedauto-selecthandler1PASS2FAILRC1 actual unwanted PATCH on selection,
not fulloldHEAD. Restored11/0RC0. ActualPG noPATCH/noGETonselection/originalroleonly/
newerdraftkept/secondexplicitSave/unchangedclear/403noclaimnorefresh/503acceptedrole+
newerrevertenabled/inheritedADMINgroupunchanged/no runtime errors. Broad verification completed on this working tree: all API batches and separate
sync-preview644/automations132/2FA37/SAML55 first RC0. Sync browser stages
95+144=239 and native stages116+111+19=246 first RC0, each stage in its own
call, not claimed as uninterrupted. Config16/14/docs4/glossary harness3/reaper4
first RC0. All190 browser suites final2183PASS/0FAIL, accepted outer RC0,
each suite in its own call. Suite024 second unchanged after PostgreSQL55668
bind failure; suite031 third unchanged after two PostgreSQL55544 bind failures.
Those attempts had wrapperRC0/0PASS/1FAIL but outer runner correctly RC1,
before application startup/assertions. Listener inspection found none; nothing
killed and no app fix. Other188 browser suites first RC0. Failed attempt logs
preserved. Final web/API units and builds both cached RC0 after earlier actual
web execution. Final desktop/mobile screenshots re-inspected after broad run:
saved ADMIN badge, unsaved MEMBER choice, Save/help/receipt readable; no overflow.
Mobile member name remains above viewport. No broader external acceptance claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance gaps unchanged.
