# 0421 QA branch selection

## Developer review
QA client now encodes optional branch and locale with URLSearchParams. Screen
captures both before request, retains existing latest-request/project/destroy
fences. Independent branch discovery has its own loading/error/retry generation.
Project visit resets main. Default-main findings do not wait for branch discovery.

## Product review
Checks previously always read main although API supports branch. Selector now
exposes saved branch checks. Scope and empty messages name branch. Branch retry
keeps current findings/locale without rerunning checks. Nonmain keys are plain
text, not misleading links to default-main editor; guidance says select matching
branch in Editor. No branch deep-link/focus or live-editor checks claim.

## Design review
Inspected qa-branch-scope pixels: release selector, saved-branch guidance, he filter
and release.only finding fit without overlap. Existing narrow QA21 checks retain
separated columns. No redesign.

## Security review
Existing authenticated read endpoints only; no new privilege/schema/worker/account/
credential/provider/license/spend changes. Fixed errors, branch/locale query values
encoded. Owner upload evidence/live target checked before push.

## QA/integration review
Unit4: captured branch+locale/stale result, failed discovery/retry preserving checks,
project/destroy metadata fences. API265/31 web706/53 builds0 initial442.26kB. New
browser7/0 twice: real different main/release findings, held stale release cannot
overwrite newer main, independent failed/retried discovery, locale retains branch.
Initial6PASS1FAIL fixture release key had no base value, so no QA finding correctly;
seeded source text, final7. Existing QA21/0 with explicit branch empty-copy assertions.
All API/isolated browser suites final0; sync staged95+144239unique0. Native first
116PASS0FAIL but shutdown/checkpoint incomplete RC1/no checkpoint, rejected, no live
matching child remained. Fresh optional55680 first116/middle111/tail19 all inner/
outer0:246total242unique/four startup repeats. No uninterrupted claim or host-
interrupted checks. Final configs16/14 docs4-138routes/reaper4 all0; checkpoints
removed.22FULL7PARTIAL1MISSING/defaultOFF and external acceptance unchanged.
