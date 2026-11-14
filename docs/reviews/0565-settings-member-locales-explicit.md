# Explicit direct member locale scope Save

## Developer review
Existing allowedLocales PATCH only, no role in body. Local raw per-member draft;
parsed trimmed deduplicated snapshot. Clear only unchanged raw text, keep newer
text. Pending guard spans PATCH/reload and blocks same-member role/locale Save
in both directions. Accepted scope reflected locally before reload, so failed
refresh still allows a newer explicit revert. Other row drafts preserved.

## Product review
Members previously had read-only direct scope in Settings and Add upsert as the
only UI way to revise it. Direct MEMBER scope now editable explicitly. Blank
means all locales, across the team, not project visibility. Group union may
widen access; help and effective access remain visible. ADMIN/OWNER direct scope
not editable here. No automatic save or second request. Server remains authority.

## Design review
Labeled direct-write locale input, explicit Save locales, saving state and
aria-describedby/invalid. Invalid text stays intact with visible correction.
Desktop1278x899/mobile390x844 pixels inspected: scope, Save, team/all-locales/group
warning and saved/unsaved receipt readable without horizontal overflow. Mobile
member identity/effective badge above viewport. Blank broadening is stated before
Save, no silent all-locales conversion from comma-only input.

## Security review
Review found comma-only/empty-entry input could normalize to all locales despite
not appearing blank. Fixed: nonblank comma-separated entries must all be nonempty
known project codes; all-whitespace blank explicitly means all locales. Duplicate
codes deduplicated, order irrelevant for unchanged check. No backend/auth/default/
worker change. UI permission visibility not authorization. Actual local PG member
writes prove removed direct locale denied, saved locale and inherited group locale
allowed. Only disposable demo membership/group changed, no actual account grant.
No registration, spend, credential change, license choice or external request.

## QA review
19 targeted unit cases; first and reviewed full web actual/API cached RC0. Initial
build web actual/API cached reported inner RC0 but outer tool RC1 because detached
children were terminated after return; repeated with reaped runner both cached RC0.
Focused first14PASS/0FAIL; after empty-entry review fix15/0. Isolated auto-save on
typing substitution3PASS/2FAIL RC1 at local-only boundary; restored15/0. Not full
old HEAD. Real PG/browser checks: unknown and comma-only invalid/unsent, no PATCH
or GET on typing, original locale-only snapshot, duplicate/cross-role guard,
newer draft retention, actual write authorization and inherited union, explicit
second Save, blank all-locales actual access, 403 no saved claim/refresh, accepted
scope and newer revert after 503, inherited group unchanged, runtime zero errors.
Broad verification: all191 browser suites first2198PASS/0FAIL/RC0, each in its
own call. API a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55
first RC0. Sync stages95+144=239, native116+111+19=246 first RC0, own calls,
not uninterrupted. Config16/14/docs4/glossary harness3/reaper4 first RC0.
Final web/API units both cached RC0; final build web actual/API cached RC0
under reaped runner. Final desktop/mobile pixels re-inspected after broad run,
matching reviewed state, scope/Save/warning/receipt readable without overflow.
Final docs4/diff/node checks RC0. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
