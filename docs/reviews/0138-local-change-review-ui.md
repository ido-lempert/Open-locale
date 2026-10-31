# 0138 - Materialized local change review UI

## Developer pass
Typed localChangePlan response displayed within prepared repository draft review.
Current/draft values use existing missing/empty renderer. Independent50-row local
change pages and computed slices; clearDraft resets page as well as draft/choices.
All prior draft lifecycle guards retained. No API or application mutation changes.

## Product pass
Shows set/removal/unchanged counts and operation/current/draft values. Locale-only
removal explicitly never deletes project key or another locale. No-op draft has
clear empty state. Review data not permission to apply. No values, repository file
or baseline changed. Actual guarded apply remains future work. Coverage unchanged
22FULL/7PARTIAL/1MISSING, no external acceptance.

## Designer pass
Inspected real desktop/480px screenshots of explicit removal. Counts, scope notice,
operation labels and current/draft columns readable on desktop; narrow table has
its own keyboard-focusable scroll region. Draft/digest/download fit screen. Removal
uses text plus tint; no color-only meaning. Independent pages avoid unbounded DOM.

## Security pass
UI consumes server materialization, never supplies local plan or expected values.
Existing fresh-source/fingerprint authorization path unchanged. Interpolation only,
no HTML injection. No apply/import/write action, credentials, enrollment, expanded
scope, spending or license choice. Invalidated draft clears derived rows/pages.

## QA/integration pass
Browser92->98 real PG/API/UI: exact set/missing current value, deletion-scope/no-
apply notice, explicit locale-only removal/current value, no-op state,50-row
materialized change limit and independent pagination. Web47->48/7 adds page bound/
reset coverage. API248/30,sync153 unchanged; builds/reaper4 RC0.
43 integration/config legs passed individually;13 completed successful fail-closed
batches. Initial TM leg and isolated retry failed closed at0 checks because default
PG port55442 could not bind, no app checks executed. Added validated test-only
TM_TEST_PG_PORT override, ran full real TM18 on15442 RC0 without stopping another
process. No UI/app test failure or host interruption this slice.
Native visual116+128=244/two repeated startups/242 unique, every source label
covered,both inner/outerRC0,checkpoint removed. Both stages explicit local test
port15434, staged not uninterrupted. Units/builds/reaper give48 inventory legs.
