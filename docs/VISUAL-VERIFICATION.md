# Visual verification

Build the API first. The normal full run remains:

```
npm run test:visual
```

When the host limits command duration, run two stages with an explicit new,
absolute private checkpoint directory. Do not reuse another run's directory.

```
VISUAL_STAGE=first VISUAL_CHECKPOINT_DIR=/tmp/open-locale-visual-run npm run test:visual
VISUAL_STAGE=second VISUAL_CHECKPOINT_DIR=/tmp/open-locale-visual-run npm run test:visual
```

First-stage success is NOT a complete visual pass. It prints a stage-specific
marker, never the full success marker. The second stage resumes the same stopped
PostgreSQL data, project, browser token, URL and viewport. Checkpoint metadata
must be private, owned by the current user and tied to the exact runner source.
Both stage commands must exit0, with no FAIL lines. Together they run244 checks:
242 unique checks and two repeated API/web startup checks. This is staged
verification, not one uninterrupted browser session.

The checkpoint contains local fixture account/session data. It is removed after
stage2 or a handled stage failure. If interrupted by a host kill, clean up only
that run's processes and checkpoint, then restart from stage1. Never commit or
share a checkpoint. A source change invalidates the checkpoint. Negative
preflight checks run with `npm run test:visual-stage-config` and in the sweep.

If the default local PostgreSQL port55434 is occupied, use the same explicitly
chosen `VISUAL_TEST_PG_PORT` for both stages. Do not stop another process to free
it. The test-only override accepts1024-65535 and does not change application ports.
Incomplete cleanup is bounded; an exit guard allows exit0 only after the explicit
stage/full success path. The occupied-port regression proves startup failure
cannot be reported green, even if a dependency leaves an unresolved stop promise.

The translation-memory HTTP fixture similarly accepts `TM_TEST_PG_PORT` when its
default55442 is occupied. This changes only its isolated database port, not the
application API or test assertions. Do not stop another process to free a port.
