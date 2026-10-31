# 0119 - Reproducible visual checkpoint stages

## Developer pass
Optional first/second stage uses one source, not generated duplicate tests.
No assertion removed. Move shared wait helper/project binding to common scope;
retain default full flow. First stage cannot print full success. Count assertions
and identify staged totals. Shutdown failure prevents checkpoint publication.

## Product pass
Verification improvement only, no application or coverage promotion. Explicit
staged-versus-uninterrupted result semantics documented. Default remains full.

## Designer pass
No UI change. Both real stage runs and default run captured existing UI through
all visual checks. No new design claim or screenshot required for runner code.

## Security pass
Fresh mode0700 checkpoint directory, state0600, no symlink/public/wrong-owner
resume. Exact runner source hash checked before DB/browser startup. No token
printed, checkpoint removed after completed second stage/handled failure.
Interrupted-host cleanup caveat documented. Local fixtures only.

## QA/integration pass
Nine real preflight negative checks: invalid stage, relative/missing stage,
public directory/state, symlink, source mismatch, failed first stage, existing
checkpoint. Initial real stages116/128 PASS (244 total,242 unique); both outerRC0,
checkpoint removed. Default unchanged full run242 PASS with inner/outerRC0.
Final reruns follow last shutdown/count checks before commit.

Final48 unique sweep legs individualRC0,43 integration/config legs completed
in eight fail-closed batches outerRC0. API205/24 suites, web24/5, both builds,
reaper4. Final staged116/128 checks inner/outerRC0, checkpoint removed, every
source assertion label present. Final default full242 checks inner/outerRC0.
One attempted full rerun was accidentally batched after other checks and hit
the shared120-second call limit at237/242. That envelope was interrupted, not
passed. Cleaned its browser/server groups and confirmed-defunct socket, then
standalone unchanged full rerun completed242/RC0. No assertion weakening.
