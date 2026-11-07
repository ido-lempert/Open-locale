# 0433 Diagnostic history read guards

## Developer review
Explicit refresh guards pending/destroyed handlers; load refuses after destroy.
Existing generation fences prevent older reads across projects. Fixed error
replaces raw exception text. No API/schema/dependency changes.

## Product review
Current diagnostic history can recover through Refresh history. Fixed error
retains admin prerequisite. Records still caller-file diagnostics, not verified
GitHub state/completed syncs/accepted baselines; no apply control or write added.

## Design review
Desktop failure and 390px empty-recovery pixels inspected, bounded error and
Refresh readable beside existing diagnostic-only notice. No overlap.

## Security review
No raw exception detail, stale records or post-destroy reads. Existing admin
requirement preserved. No provider/worker/account/credential/license/spend changes.
Owner upload authority and live target checked before push.

## QA/integration review
Unit4 failure/recovery/duplicate/destroy/project-race. Browser6 before/after final
wording: actual failing/held reads, exact diagnostic recovery, no private text,
no apply/writes, late project response ignored/post-destroy handlers silent.
API265/31 web759/65 builds0. All API/isolated browser checks passed on initial
fixed-error wording. Sync second143PASS1FAIL exposed lost admin guidance; app
fixed to include prerequisite without raw detail, units/build/history browser
rerun. Final sync separate95/144239unique; native116/111/19 (246total242unique/four
repeats) inner/outer0 on final wording. Final16/14/docs4-138routes/reaper4 all0.
No interrupted tests/canonical uninterrupted claim. Checkpoints removed.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
