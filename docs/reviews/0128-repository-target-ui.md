# 0128 - Repository target configuration UI

## Developer pass
Real API CRUD from file-preview link, separate route. Revision snapshot on edit,
body snapshot at save, one busy operation, generation checks on async response/
error/finally. Route reuse resets all data; late old-project save cannot update
new screen. Failed save/refresh preserves typed values and old record for review;
explicit refresh replaces stale edits. Removal requires selected confirmation,
cancel keeps config. Six lifecycle unit tests cover failure/destruction/navigation/
remove/duplicate submits/snapshots/refresh. Cancel now clears obsolete error.

## Product pass
Configuration only prominently stated. No credentials, connected repository,
accepted baseline or execution claim. Each record says not connected/cannot run.
Save changes metadata only, removal explicitly leaves repository files and
translations alone. No token/password fields. No coverage promotion or external
acceptance. UI can configure future target without claiming GitHub sync works.

## Designer pass
Inspected desktop and480px actual screenshots. Warning, labeled fields, empty
state, saved cards/revision, edit/remove controls readable. Two columns collapse
to one, fieldset minimum width0 and coordinate wrapping prevent overflow. Native
fieldset border softened; stale validation error no longer remains after cancel.
Buttons disabled during operation; errors/status have alert/status roles.

## Security pass
Angular interpolation for coordinates, no HTML rendering or remote service links
built from untrusted strings. Server owns role/scope/revision checks. Member
denial renders no form/records. No browser persistent data or new credentials.
Held real POST continues on original project only after navigation; UI generation
rejects old response. Client cannot silently overwrite a newer revision; typed
stale edit retained for inspection, explicit refresh required.

## QA/integration pass
Sync browser42->58: navigation warning/empty state, real create/reload/edit,
external revision conflict and preserved typed edits/no overwrite, refresh, invalid
path preservation,480px fit, remove cancel/confirmation/real delete/no translation
change, same-component project reset, held real save old-project-only/new screen
unchanged, member no-form denial. Six unit tests web29->35 in6->7 suites. API240/28
unchanged; both builds/reaper4 RC0. Initial remove-cancel assertion raced Angular
rendering, fixed test wait and reran. No app workaround or hidden failed checks.

43 integration/config legs in nine completed fail-closed batches all individual/
outerRC0; unit/build/reaper legs give48-leg sweep inventory. Native visual116+
128=244 total/two repeated startups/242 unique, every source assertion covered,
both stage inner/outerRC0, checkpoint removed. Staged, not uninterrupted. No
interrupted verification this slice. No active test services retained.
