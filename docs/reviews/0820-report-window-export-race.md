# Project dashboard export after usage-window race

## Developer
Unit holds both usage reads and resolves old first, confirms export blocked
while newest remains pending, then newest payload exports. Browser resolves
newest first then releases old real response. Serialized Blob is inspected.
No application change.

## Product
Export uses loaded ninety-day usage, independent loaded task cutoff, and
singleDatabaseSnapshot false. Does not relabel old figures or initiate reads.
Browser exercises actual download control; file-save completion is not claimed.

## Designer
No layout/copy changes. Existing narrow-screen retained branch check rerun.
No new screenshot or changed-pixels claim.

## Security
Serialized payload remains scoped loaded dashboard data. No new writes,
sharing, tokens, providers, workers, license or spend. Unit still verifies
whitelisted fields. Browser intercepts local Blob/anchor only for payload test.

## QA/integration
Reports7 suites94 tests pass. Refresh browser18PASS/0FAIL, including blocked
pending export, actual control after both responses, exact loaded windows,
no sibling reads, stale-export negative probe and restored payload check.
Browser uses3usage/1task/1progress/1quality reads. All first-attempt green.
This is affected reports coverage only. No build, full-web, all-backend,
native/sync/provider acceptance rerun. Latest full-web checkpoint remains751.
Coverage22 FULL/7 PARTIAL/1 MISSING, defaultOFF, external acceptance unchanged.

Five review perspectives complete, no remaining scoped finding before commit.
