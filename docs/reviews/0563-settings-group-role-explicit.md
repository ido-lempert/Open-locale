# Explicit group role Save

## Developer review
Role selection is per-group local draft, not a PATCH. Explicit Save snapshots only
the selected role; per-group pending guard covers PATCH and reload. Clear only
unchanged draft; preserve newer selection. API path/body unchanged. Valid roles
MEMBER/ADMIN, missing/unchanged/invalid choice cannot Save. Other groups' map keys
retained. Review caught accepted PATCH plus refresh failure leaving stale role and
wrongly disabling a newer revert: update loaded local group to the accepted role
after PATCH success, before draft clear/reload. Unit and real PG 503 leg prove it.
No optimistic change before success. Server remains authoritative.

## Product review
Group role applies team-wide access, so selecting a dropdown option must not by
itself apply it. Explicit Save role, nearby effect explanation and saved/unsaved
receipt separate choice from effect. Newer choice is never auto submitted.
Successful PATCH is not undone by refresh failure. Existing group-grant union,
rank visibility and server checks unchanged. No backend policy change.

## Design review
Save disabled for unchanged/empty/invalid/pending choice; Saving role label while
pending. Dropdown stays editable. Actual role badge stays distinct from draft.
Desktop1278x899/mobile390x844 pixels inspected: admin badge, newer member option,
Save role, complete help and receipt readable with no horizontal overflow. Role
selector uses attr.name for stable DOM hook with ngModel. Button type=button.

## Security review
Only disposable local DB groups tested; no actual connected account grant change.
No new worker, provider, account, spend, registration, credential or license change.
Selection alone sends no PATCH or GET, verified real transport; direct duplicate
blocked per group. Existing canManageGroup and server rank checks authoritative;
UI validity is not an authorization boundary. Fixed text receipt, no HTML/user
interpolation. No change to direct/group union grant semantics.

## QA review
12newunits first and reviewedwebactual/APIcachedRC0, buildwebactual/APIcachedRC0.
Focusedfirst10/0RC0, isolatedauto-selecthandler substitution1PASS2FAILRC1 proves
actual unwanted PATCH on selection (not fulloldHEAD), restored10/0RC0. ActualPG
originalroleonly/newerchoicekept/explicitsecondSave/unchangedclear/403noclaimnoGET/
503acceptedroleandnewerrevertenabled/othergroupuntouched/no membership edits.
Review cleanup removes unused demo user setup; native fixture now explicitly
clicks Save role and waits per-group pending false on promotion and demotion,
retaining every original inherited-grant assertion. Focused reviewed and broad
checks pending. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external gaps unchanged.

## Broad regression
Reviewed focused10/0RC0 after unused fixture-user cleanup. All189browser suites
firstRC0/2172PASS/zeroFAIL, each owncall. APIa/b/c/d+separatesync-preview644/
automations132/2fa37/SAML55firstRC0. Sync95+144=239/native116+111+19=246 allfirst
RC0, separatecalls staged not uninterrupted. Native explicit Save role clicks
retain original inherited-grant assertions. Config16/14/docs4/glossaryharness3/
reaper4allfirstRC0. Finalunits/buildbothcachedRC0, docs4/diff/nodechecksRC0. Latestpixels
reinspectedreadablenooverflow.
