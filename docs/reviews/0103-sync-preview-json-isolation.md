# 0103 - Flat JSON sync preview and prototype-safe export

## Developer review
Added a pure three-way planner for an explicit caller-provided baseline, local
flat string map and remote flat string map. Missing is null, distinct from an
empty string. Sorted per-key decisions identify unchanged, converged,
local-only, remote-only and conflicting edits. Deletions always require manual
resolution. A SHA-256 fingerprint binds all three maps and remote blob SHA;
it is not a signature, permission, or durable concurrency lock. A future
executor must re-fetch/check state under project/locale authorization.
Bound maps to 512KiB and 10,000 keys; union also bounded. JSON parser rejects
nested/non-string data, unsafe keys, controls and duplicate properties,
including escaped equivalents. Dots remain literal, never expanded.
Initial compile failed because Object.hasOwn needs a newer TypeScript lib;
use hasOwnProperty.call without changing the project's target.

## Product review
Planner is not wired to product endpoints, a worker, or transport yet. No
persistence, credential setup, journal, preview UI, application of decisions,
or live GitHub sync acceptance. GitHub remains MISSING in the audited map.
Caller must supply a known baseline; an empty map is NOT an invented baseline
for an existing integration. Existing GitHub transport updates existing files
only, so caller still must handle missing files explicitly.

## Designer review
No UI changes. Future preview must show direction, deletions, conflicts,
repository/branch/path and project/locale. No new visual claim this slice.

## Security review
While reviewing existing import/export helpers, confirmed unflattenJson could
write Object.prototype via __proto__.probe. Added a discriminating regression:
old helper wrote the probe, new helper does not. Another regression proves
exact __proto__ data was dropped by flattening. Null-prototype dictionaries
and own-property traversal fix both, including exportJson's initial map.
Preserve these names as ordinary data rather than silently losing them.
Existing Nest JSON body transformation strips some special properties before
service import; HTTP regressions use CSV to exercise database-to-JSON export
with real stored names. This is not a claim that direct JSON import preserves
all special names, or that every format is prototype-safe.

## QA/integration review
New planner cases cover all decisions, additions/removals/delete-vs-edit,
missing versus empty, deterministic content/SHA-bound fingerprint, immutability,
duplicate/escaped keys, malformed/unsupported/oversized inputs and union bound.
Two existing-helper regressions deliberately failed before fix and pass after.
Three new real HTTP/PostgreSQL format checks cover prototype-named exports
and locale enforcement. First two HTTP runs failed because JSON DTO stripping
prevented the intended keys reaching storage; changed the fixtures to CSV,
not application code, then all format checks passed. Unit/build counts and
final full-sweep outcome recorded in milestone report. No real GitHub requests,
external registrations, token scope changes, or new credential storage.

### Verification harness review follow-up
Two execution batches were interrupted at the 120-second command cap during
the existing 2FA suite's multiple real-clock waits. No suite success was
counted for interrupted attempts. Shortened redundant waits: after consuming
a +1-skew code, concurrency waits until current counter is strictly later;
disable then uses a fresh +1-skew code. Both use the real verifier, not a
mocked clock or replay bypass. Monotonic replay and concurrent one-winner
checks remain. Standalone 37-check 2FA suite passes within the command cap.
A browser batch printed all leg successes but the runner reported detached
child cleanup on return; final verification must settle with a clean exit.
Browser cleanup root cause was Nx serve's descendant web process surviving
termination of its parent. Both browser harnesses now launch Nx in a separate
process group, kill the group and await close of all owned server children.
OIDC 24 and SAML 23 checks then returned with clean command RC=0. This is test
harness cleanup, not an authentication product fix.
