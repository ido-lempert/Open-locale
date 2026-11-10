# 0502 Saved source context for translation matches

## Developer review
Project metadata publishes base source locale with options. Search captures it
before awaiting the existing listKeys read and projects the source and matching
locale's base values from that returned key. Existing generation fencing clears
source text with results on scope/query/mode/project edits and error. Missing
source row is null, empty saved source remains an empty string. No extra read,
endpoint/filter/storage/mutation/dependency change.

## Product review
A found target string now carries source-language context without opening the
editor. Both locales are named. Missing source row and empty saved source are
different states, not invented text. Same-locale source is not duplicated. This
is loaded saved base-value context, not plural forms/local drafts/newer changes
or a transactionally synchronized project-metadata/list snapshot. Metadata and
key-list remain separate reads. Existing query/match/branch/locale/list limits
remain and no edit/apply action is added.

## Design review
Actual desktop and390px screenshots inspected including scrolled nonempty source:
two readable columns on desktop, stacked sections on mobile, source and target
headings distinguish values. Empty/absent messages clear; markup rendered as text.
No page overflow. Source text preserves line breaks and wraps inside its card.

## Security review
Only already-authorized returned translation data is projected, no extra request
or new audience. Angular interpolation escapes source and target; actual markup
fixture shows text without creating an image. Private source context disappears
with stale result clearing. No provider/worker/credential/account/license/spend
change and no new backend behavior.

## QA/integration review
New6units/web1343 in130/API265 in31/builds0(API cached). Focused7/0initial+final:
actual saved source/target, missing vs empty rows, escaped markup, exactly one
existing key GET/zero writes, scope edit clears private context, same-locale no
duplicate,390px/runtime. Oldapp1PASS then expected missing-source-element abort,
full log retained, restored current/final7/0. Existing exact projection unit
expected row updated for the added source field before fullunit first green.
All API/transport scripts completed0 first actual suite attempts. One wrong
2FA script filename failed before running tests (module not found), then the
existing package command ran37/0 without app/test changes; both logs retained.
All 129 isolated browser suites completed first-attempt exit 0, with 1,391
assertions and no failed assertions or code changes during the sweep. Sync ran
in separate stages: 95 + 144 = 239 unique checks. Native ran in three separate
stages: 116 + 111 + 19 = 246 total, 242 unique with four startup repeats. Every
stage completed inner/outer exit 0 first attempt. These are preserved staged
results across continuations, not one uninterrupted run. Configuration checks
16/14, docs 4 (138 routes), and reaper checks 4 passed. Final docs rechecked after
this evidence update. Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING; external
acceptance gaps and default-OFF workers remain unchanged.
