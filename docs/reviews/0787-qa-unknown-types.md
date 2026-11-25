# QA unknown issue-type labels

## Developer
Label takes unknown and returns fixed fallback for nonmembers. Review found that
class concatenation still coerced malformed types, including an array with a
known member acquiring that member's visual style. Fixed with bounded string
membership and neutral unknown class. Raw findings remain untouched.

## Product
Unknown types are visible as Unknown issue, not blank or a guessed known type.
All loaded rows and raw download retained; known issue filter remains exact.
No unknown type selectable as an invented server-supported filter.

## Designer
Inspected updated desktop thirteen-row and390px filtered screenshots. All six
known badges preserved; seven unknown/malformed rows have neutral readable
labels. Initial review showed array masquerading as known styling, corrected
and re-inspected. Narrow table focus/scroll retained.

## Security
No raw unknown value is coerced into labels or classes. Fixed generic label,
neutral class, literal detail interpolation and unchanged private raw download.
No backend, credentials, worker, license, sharing, spend or provider change.

## QA/integration
- QA8 suites57 tests pass, including throwing coercion hook and malformed input.
- Real local browser10/0: six known/seven unknown fixtures, targeted blank-label
negative detected/restored, neutral styling, literal details, exact known filter,
raw-key local search, exact full raw download, one GET/no write, no runtime errors.
- Browser rerun green after class fix. Production web/API builds pass via reaped
runner. Initial direct Nx build logged success but detached daemon cleanup made
outer command nonzero, runner also detected live Nx plugin descendants. Disabled daemon/plugin isolation
and reran both with runner: exit0, cached successful artifacts.
- Docs consistency4 checks/138routes, syntax/diff checks pass.
- API/PostgreSQL real with intercepted QA response, no whole-product/native/
sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING and external
acceptance gaps unchanged. Latest full web baseline719:311 suites3783 tests.

Five review perspectives complete, scoped findings fixed before commit.
