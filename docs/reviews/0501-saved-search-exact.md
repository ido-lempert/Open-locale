# 0501 Whole-value saved translation search

## Developer review
Optional valueMatch validates contains/exact and requires a nonempty valueSearch.
No parameter keeps prior substring behavior. Exact mode uses case-insensitive
whole-value equality, with pattern characters escaped because Prisma implements
insensitive equality using ILIKE. Space is significant, not trimmed. Page mode
changes clear results and fence old reads before manual search. Project reuse
resets mode. No editor-grid/bulk review or translation-write changes.

## Product review
Whole value helps locate a saved string without longer substring matches. Match
selector and result count name the chosen mode. Existing single branch/locale,
saved base value scope remains, not plural forms/key names/local drafts. Text
limit200, no empty/whitespace-only UI query. Existing nonpaginated list limits
remain; no regex, fuzzy, normalization or cross-locale matching claim.

## Design review
Actual desktop and390px screenshots inspected: Match sits beside branch/locale,
form wraps with readable query/search and count/result. Scope states literal,
case-insensitive matching and significant spaces. No overflow or hidden controls.

## Security review
DTO whitelist contains/exact and service query-required guard. Literal escaping
covers both substring and whole-value modes, with real wildcard/backslash test.
Existing authentication/project/branch/locale boundaries retained. No new data
kind, effect, dependency, credential/account/license/worker/provider change.

## QA/integration review
New9units/web1337 in129/API265 in31/builds0(API final cached). First focused
10PASS1FAIL exposed Prisma insensitive equality pattern behavior for percent/
underscore/backslash; escaped exact pattern, rebuilt/same test11/0, final11/0.
Full initial failure log retained. Intentional oldAPI8PASS3FAIL excludes actual
whole-value/query-required/UI correctness; restored current service/final11/0.
Actual database exact excludes longer/space/otherlocale/branch values, substring
unchanged, exact spaces/literal patterns, invalid/queryless mode400, UI manual
mode request/count/zero writes/held old response/390px/runtime. API batches a/b/c/d/sync-preview644/2fa37/saml55 first-attempt0. Automations
first command timed out after132PASS/noFAIL but before final completion/exit,
not counted as pass; no process remained/full log retained, direct same-script
rerun132PASS/noFAIL RC0. All128 isolated browsers first-attempt0/no post-fix browser failureabort.
Separate sync95+144239unique/native116+111+19246total242unique/four startup
repeats each inner/outer0firstpass. Config16/14/docs4-138routes/reaper4all0.
Completed checks preserved across continuations, staged/not uninterrupted. Coverage and
defaultOFF unchanged.
