# 0425 Loaded project search

## Developer review
Computed visibleProjects derives from the complete loaded project signal. Query
changes only capped local state, leaving read generations, creation receipt/draft
and security state untouched. Current reload results use current query. Destruction
guards query edits. Existing creation/read behavior unchanged.

## Product review
Find projects by name, slug or locale code without leaving the page. Explicit
loaded-only/literal case-insensitive semantics, match count and no-match guidance;
Clear restores loaded cards. Refresh remains explicit for newer changes. No server
search, automatic polling or durable query/draft claim. Search may hide a newly
created project until cleared, with loaded match count visible.

## Design review
Inspected desktop/390px full-page screenshots: labeled full-width search, Clear,
match guidance and filtered project card readable, no overlap/horizontal overflow.
New-project draft and separate two-factor panel retained. No redesign.

## Security review
No new API/privilege/schema/worker/provider/account/credential/license/spend changes.
Literal includes rather than regex/markup evaluation, query capped200. Browser
verifies no account GETs/writes while searching. Existing authenticated project
list controls audience. Original owner upload scope/live target checked before push.

## QA/integration review
Unit3 literal/case/name/slug/locale, full-list identity, form/receipt/security
retention/no requests, cap/destroy guard. API265/31 web720/57 builds0 initial444.16kB.
New real browser7/0: two projects, name/slug/locale/literal no-match/Clear, retained
form/security/zero requests and narrow fit. Initial6PASS1FAIL fixture HE also matched
Checkout name correctly; discriminating FR locale probe fixed, no application change.
All API/isolated browser regressions final0; sync staged95/144239unique, native
separate116/111/19 (246total242unique/four repeats), all inner/outer0. Final16/14,
docs4-138routes/reaper4 all0. No interrupted checks or uninterrupted canonical claim.
Checkpoints removed.22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
