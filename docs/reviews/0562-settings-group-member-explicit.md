# Explicit group member Add

## Developer review
Selection stores local per-group draft, no request. Add snapshots user ID; pending
map blocks duplicate calls for that group through PUT and reload. Newer selection
is retained, unchanged submitted choice clears. Spread updates retain other
groups' selections, pending flags and receipts. Explicit type=button. Existing
API request path/body and server permission checks unchanged.

## Product review
Selecting an option must not itself apply a team-wide grant. Explicit Add member
with nearby explanation separates choice from effect. Successful PUT receipt
identifies submitted member as added and any current selection as not added by
that request. No auto retry or second member submission; no claim refresh undoes
an accepted membership. Refusal keeps choice, no success receipt or refresh.

## Design review
Empty/pending Add disabled; pending label Adding member. Dropdown stays editable,
newer choice does not trigger a grant. Existing team-wide union explanation stays.
Desktop1278x899/mobile390x844 actual pixels inspected: actual First member row,
Next member selector, explicit Add, help and complete receipt readable/nooverflow.
Dynamic receipt uses attr.name (p has no name property); select attr.name supplies
stable DOM hook because ngModel's name input alone did not populate it.

## Security review
No backend scope/permission changes, existing canManageGroup visibility and server
checks authoritative. Selection alone sends no PUT, verified actual transport.
Only isolated disposable local DB accounts/memberships exercised, no connected
account access grants changed, no external requests/registration/spend/worker or
credential changes. UI guard is not an authorization boundary. Team-wide role and
locale union semantics unchanged. Receipt fixed text, no HTML/user interpolation.

## QA review
9newunits firstfullweb2171/186actual/API265/31cachedRC0. InitialbuildRC1 dynamic
p.name binding unsupported; fixedattr.name. Correctedbuildwebactual/APIcachedRC0.
FirstfocusedRC1 selector timeout; diagnostic2groups/canManage true, dynamic select
ngModel.name not DOMname. Fixedattr.name. Correctedfocused10PASS/1FAILRC1 receipt
clear assertion before CD; fixedfixtureexplicitabsencewait, no appfix. Reviewed
11/0RC0. Isolatedauto-selecthandler substitution2PASS/2FAILRC1 actual PUT on
selection, not fulloldHEAD. Restored11/0RC0. RealPGdemo team membership+groups,
noPUT/noGETonselection/explicitoriginalonly/duplicateblocked/newerselectionkept/
secondexplicitAdd/unchangedclear/403noclaimnorefresh/503savedeffect+newerunsent/
othergroupuntouched/runtime0/390px. Final afterfocused change type=button only,
reviewedunitswebactual/APIcachedRC0,reviewedbuildwebactual/APIcachedRC0 and
focusedfinal11/0RC0. Coverage22FULL7PARTIAL1MISSING,
defaultOFF/externalacceptance gaps unchanged.

## Broad regression
APIa/b/c/d+separatesync-preview644/automations132/2fa37/SAML55allfirstRC0.
Syncfirst95+second144=239firstRC0. Nativeinitialfirst116RC0/middle5FAILRC1
incomplete: old fixture expected immediate member add on selection, absent chip
caused inherited union/promotion/demotion failures then remove-undefined abort.
Checkpoint cleaned. Updated native fixture ONLY explicit Add click+per-group
pendingfalse wait; all original membership/union/promotion/demotion/removal
assertions retained, no appfix. Freshfinalnative116/111/19allRC0, separatecalls,
not first/uninterrupted. Config16/14/docs4/glossaryharness3/reaper4firstRC0.
All188browserfinal2162PASSzeroFAILRC0;187firstRC0. Browser069firstRC1/0PASS1FAIL
and secondwrapperRC0/0PASS1FAIL correctly rejected by outer runner, PGbind55636
address-in-use before app startup. No listener found on inspection; transient
cleared, unchanged thirdattempt3PASSzeroFAILRC0, no process killed or code fix.
Preserve initial failures, not all-first-pass claim. Final units/buildbothcachedRC0,
docs4/diffcheck/nodechecksRC0. Latestpixels reinspected readablenooverflow.
