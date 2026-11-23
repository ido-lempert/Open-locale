# Guard loaded task due-date display

## Developer
Bounded date formatting replaces the unguarded row pipe. A nonempty string must parse as finite before formatting, and DatePipe failures return Due date unavailable. Invalid values have no datetime attribute; valid values retain their exact full timestamp. Formatting uses injected locale and explicit UTC mediumDate, matching prior semantics. No details-editor or payload change.

## Product
Malformed loaded dates no longer interrupt the entire task list. Fallback invents no date and repairs no server state. Null/empty absent dates remain absent. Existing local ordering still places invalid dates after valid dates. Explicit read can recover valid display without changing tasks or local form.

## Designer
Inspected actual1280px and390px screenshots. Fixed fallback fits beside existing controls, neighboring rows remain readable and no horizontal overflow. Valid UTC day agrees west of UTC. No raw malformed text is shown.

## Security
No new endpoint, storage, permission or external destination. Malformed markup is neither rendered nor included in an invalid datetime attribute. Existing update/delete identity and uncertainty fences remain intact.

## QA and integration
- Focused task units50/0, ten new timestamp/formatter cases cover missing, blank, malformed, non-string values and exact valid UTC day.
- Nonoverlapping staged web units136files/1712tests plus136files/1558tests =272unique files/3270tests passed. Staged, not uninterrupted.
- New real browser/API/PostgreSQL response-interception suite6/0: invalid/absent/valid neighboring dates, full valid datetime, fixed fallback without invalid attribute or raw markup,390px layout, local ordering and explicit recovery preserving form/no writes. Existing occupied-port harness automatically discovers the new suite,3/0.
- Blank-fallback negative probe failed exactly unavailable-date assertion,5pass/1fail; restored6/0.
- All16 prior affected task browser suites passed193 assertions, including details22 and baseline31. Total199 affected browser assertions. No whole-product browser/sync/native rerun claimed.
- Real task HTTP/PostgreSQL80/0, API/web builds, docs consistency138routes, script syntax and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
