# SDK retained publication pin and query proof

## Developer
No application change. Real SDK integration now distinguishes pinned latest
from pinned retained-version reads after a new publication. Captures actual
outgoing URL while delegating to real HTTP to check query encoding.

## Product
An old publication pin on latest rejects after newer release. Same pin on its
retained version still reads and revalidates old bytes. Failed reads do not
change latest. No historical-selection fallback or broader parity claim.

## Designer
SDK-only verification, no visible UI or new screenshot claim.

## Security
Query-like publicationId containing ampersands, locale/branch-looking parts
and fragment marker remains one URLSearchParams value, with original locale,
no injected branch/fragment, and404 before wildcard304. No identity normalization
or recovery to a different bundle. No secret/provider/license/worker/spend/
sharing changes or registry publish.

## QA/integration
Real SDK/PostgreSQL/HTTP38 checks pass (33prior+5new). Mutation probe truncated
pin at first ampersand: exactly new encoded-pin assertion failed. Restored SDK
then reran38 green. Actual OTA108 checks rerun green. Syntax/diff/docs pass.
No new application code, API unit/whole-web/browser/native/provider rerun claim.
Latest API79934/318, whole-web797315/3864. Acceptance22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five perspectives complete before commit.
