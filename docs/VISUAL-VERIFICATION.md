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
