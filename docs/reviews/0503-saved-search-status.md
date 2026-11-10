# 0503 Saved translation status filtering

## Developer review
Reuses the existing key-list status parameter with the selected locale and saved
value query. Omit it for Any status. Options are unique built-in plus loaded
project custom statuses; setters reject unknown options. Manual search captures
status with scope; edits clear results and increment existing generation fencing.
Project load clears status/options before reading metadata. No backend, schema,
dependency or write changes.

## Product review
Users can find saved text still awaiting review, already reviewed, or in a custom
project status. The filter applies to the matching locale, not the source shown
beside it. Any status preserves previous search behavior. Contains/Whole value
remain independent query choices. Status names are loaded metadata, not a live
status subscription; search results are loaded saved values, not future changes.
Existing base-only/nonpaginated/snapshot limits remain. No status-changing action.

## Design review
Desktop and390px actual pixels inspected: status select has its own label and
wraps with existing fields on mobile, without overlap or page overflow. Result
count names selected status; empty copy includes status filter. Source context
remains readable and stacks. No new icon-only actions or color-only meaning.

## Security review
Only existing authorized project metadata and key-list read are used. Custom
status names use Angular escaping. Unknown client options are ignored, not sent.
Status edits clear private previous results and fence delayed responses. No new
audience, storage, provider, worker, credentials, accounts, license or spend.

## QA/integration review
New8units/web1351 in131; builds exit0 (API cached). Initial focused browser13/0:
actual PostgreSQL selected-locale status/value intersection, opposite source status,
whole-value combination, custom status, Any status omission, manual single GET,
zero writes, edit clearing, held late response refusal, empty state/mobile/runtime.
Intentional old app discriminator aborted on absent status select (0PASS1FAIL);
full actual log retained, current source restored and final13/0. No app/test fix
from discriminator. All130 isolated browser suites completed first-attempt exit0,1404 assertions,
no failed assertions, source changes or aborts during the regression sweep.
All API suites first-attempt0 including sync-preview644/automations132/2fa37/saml55.
Separate sync95+144=239unique and native116+111+19=246total/242unique with four
startup repeats, every stage inner/outer0 first attempt. Config16/14/docs4 with
138 routes/reaper4 all0; final docs rechecked after this evidence update.
Completed checks preserved across continuations, staged rather than uninterrupted.
Coverage22FULL/7PARTIAL/1MISSING and default-OFF workers unchanged.
