# 0500 Read-only saved translation search

## Developer review
Optional valueSearch extends the existing list-keys read, not a write path. It
requires a current project locale and combines with existing branch/name/tag/
status filters. Prisma parameterization plus escaped backslash/percent/underscore
keeps substring matching literal. Existing list behavior is unchanged without
valueSearch. Separate page projects only the selected locale's base value. Its
option and query generations fence stale results and route reuse; input/scope
changes clear results immediately. Search is manual, pending duplicates refuse.

## Product review
Users can find saved translation text without replacing dirty editor cells or
confusing key-name search with value search. Editor toolbar links the separate
read-only page. One branch and locale, saved base values only, not plural forms,
key names or local drafts. Query is bounded to 200 characters. Results are loaded
saved values, not a continuously refreshed view. No edits, bulk actions, restore,
translation provider call or export action. Existing list returns matching keys
without a new pagination/completeness guarantee; large projects may be slow.

## Design review
Desktop and390px actual pixels inspected: branch/locale controls, explicit scope,
query, manual Search, result scope/count/key/text readable and no page overflow.
Entry link lives in wrapping editor toolbar, not crowded header. Fixed loading,
error, empty and idle states distinguish unavailable data from no matches. Values
use escaped interpolation with preserved line breaks rather than HTML rendering.

## Security review
Existing project authorization and branch resolution precede the query; unknown/
missing locale with nonempty valueSearch rejects. Read uses existing list-keys
permissions, returns no new type of data, and requires authenticated route. Fixed
UI errors hide server details. Real outsider/oversized/missing-locale checks and
SQL-looking/wildcard/backslash strings exercise the actual socket/database path.
No dependencies, credentials, license, accounts, worker or external provider change.

## QA/integration review
New14 units, web1328 in128/API265 in31/builds0, final web rerun/builds0 after copy/layout change.
Focused browser12/0 initial+afterdiscriminator, extended15/0 and final design15/0: actual PostgreSQL
branch/locale/base-only/literal/combined-key-name/SQL-looking predicates, input/
access denial, click-through actual escaped result, stale held response, retry,
empty state,390px and zero writes. OldAPI7PASS5FAIL, full log retained, then
restored current service and reran12/0. A combined command time limit interrupted
initial full-web run after discriminator completion/service restoration; no final
counts, no remaining process. Unchanged fullweb rerun1328/128 RC0 and final rerun
same counts RC0. All API/transport batches and127 isolated browsers first-attempt0, no
post-fix browser failures/aborts. Separate sync95+144=239unique/native116+111+19=
246total242unique/four repeated startup checks, every stage inner/outer0
firstpass. Config16/14/docs4-138routes/reaper4 all0. Completed checks preserved
across continuations; staged, not uninterrupted. No parity/coverage
promotion; defaultOFF unchanged.
