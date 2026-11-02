# 0236 - Committed recovery with an unavailable browser response

## Developer pass
Real browser confirmation sends its actual authenticated POST through a fixture
proxy once. Proxy waits for upstream response/body,records201,then substitutes503
at browser boundary. Database assertions prove exact archived value,new unverified
row,one history and one intent. This is a committed response-loss simulation,not
a claim that network loss rolls back. Independent success fixture resets absence
before the existing success scenario. No server behavior change.

## Product pass
Unavailable response retains explicit possible-write warning,no success claim and
no retry. Fresh target review after commit cannot prepare recovery again. Existing
eligibility text incorrectly said no restore action exists globally;now precisely
says this eligibility check cannot restore,and points to separate target review.
No remote write,baseline advance,accepted sync or enabled worker. Coverage remains
22FULL/7PARTIAL/1MISSING/defaultOFF.

## Designer pass
Actual480x900 eligibility and response-loss screenshots inspected. Full corrected
eligibility notice readable inside audit card,buttons fit. Full unavailable-result
warning visible below configuration banner,no archived value exposed;long scope
select still truncates inside its control. No horizontal overflow visible. Other
cards/form portions continue below viewport. Screenshots are local fixture data.

## Security pass
Fixture forwards only the actual reviewed browser request to its existing local
API URL. Synthetic unavailable response contains no private server error. UI clears
private review and cannot automatically send again. Fresh review has no private
value or prepare button after commit. No new permissions/API or targeted-negative
control claim. No external provider calls in this test.

## QA/integration pass
Browser163->167 (+4checks),final167RC0. First run166pass/1failure was obsolete
eligibility wording expectation;updated assertion to current narrower statement.
Web82/7,API248/30 unchanged,final RC0. Sync644,43unique integration/config legs in
11completed green batches,each leg and outerRC0. Builds/API and web pass,reaper4,
docs4/138routes. Existing web bundle warning around555kB vs500kB persists.
Native visual staged116+128=244total/242unique,inner/outerRC0,checkpoint removed;
not an uninterrupted run. Final screenshot-only test instrumentation followed
native stages,then full browser167 reran. No app change after native stages.

Three verification calls exceeded120seconds while batching independent suites.
First interrupted batch after glossary,reran complete batch. Second interrupted
automation;its next run had zero-check stale PostgreSQL socket startup failure.
Verified zombie PID and closed port,removed stale socket,reran132green. Third
completed automation132 but interrupted OIDC browser;its retry startup had zero
passes/one suite-abort failure. Verified zombie and closed port,removed stale
socket,reran49green. No incomplete or zero-check run counted green. Narrower
batches completed. Final browser167 outerRC0 independently rechecked. No claim of
external exactly-once effects or delivery.
