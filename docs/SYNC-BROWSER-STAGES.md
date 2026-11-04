# Sync browser verification stages

The normal `npm run test:sync-browser` remains the uninterrupted entry point. On a
runner with a short command limit, the same239 assertions can run in two stages:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false
SYNC_BROWSER_STAGE=first SYNC_BROWSER_CHECKPOINT_DIR=/tmp/ol-sync-checkpoint \
  python3 scripts/run-reaped.py node scripts/sync-browser-test.mjs
SYNC_BROWSER_STAGE=second SYNC_BROWSER_CHECKPOINT_DIR=/tmp/ol-sync-checkpoint \
  python3 scripts/run-reaped.py node scripts/sync-browser-test.mjs
```

Build API first. Use a fresh absolute checkpoint path. Each command needs its own
execution window. Stage first runs95 checks; second runs144, for239 unique checks.
Neither stage alone is complete coverage. Report staged coverage distinctly from an
uninterrupted run. A nonzero wrapper status still fails even if the inner stage
printed success. Do not use a checkpoint from a run requiring forced cleanup.

The split is after preview/history/configuration route-fence checks, before a new
independent apply-project fixture. No request interception or pending request crosses
the split. Stage second starts a new browser and server, restores real PostgreSQL
files from a clean stop, restores fixture identities/tokens/repository bytes and
counter/viewport, and validates the saved project/user IDs. No browser component or
in-flight operation continuity is claimed across the split; all such tests stay
inside their original stage. All original assertion call expressions are unchanged.

Checkpoints are owned private directories with private JSON metadata containing
local fixture tokens. They bind harness source, built API, web source, database bytes,
first-stage count and failure status. This detects accidental changes, not a hostile
same-user process that can rewrite hashes. Tree symlinks and nonregular files are
rejected. Second stage verifies the bindings before startup. Successful first stage
requires a clean database stop; second-stage completion/failure removes its checkpoint.
Preflight-invalid checkpoints are not automatically deleted. Interrupted first-stage
runs may leave an incomplete directory and fixture processes: inspect and clean those
before retrying with a new directory. Checkpoints are temporary, never committed or
shared. `npm run test:sync-browser-stage-config` checks rejection/fail-closed paths.
