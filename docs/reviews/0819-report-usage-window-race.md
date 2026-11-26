# Report usage-window newest request regression

## Developer
Browser holds real seven-day read, selects90 while pending, confirms current
ninety-day data then releases old response. Unit releases old response before
new one and verifies loading remains owned by newest request. No app change.
Native select fixture resolves actual option values for numeric ngValue entries.

## Product
Changing usage window stays independent of branch progress/quality and task
reports. Older figures cannot relabel the latest selected window or end its
loading state. Does not imply all dashboards share one database snapshot.

## Designer
No layout/copy changes or new screenshot claim. Native usage window control
exercised through actual selection; existing390px retained-branch check rerun.

## Security
Only explicit expected reads, no writes or provider/worker/license/spend/share
changes. Old read response cannot publish as current window. No security-audit
or request-cancellation claim.

## QA/integration
- Reports7 suites93 tests pass.
- Actual refresh/held-window browser14/0 final:3usage reads,1progress/1quality/
1task, no sibling rereads. Stale-selection negative/restoration included.
- Initial9PASS then timeout: raw value90 did not match Angular numeric ngValue
option. Fixture now resolves native option values by displayed7/90-day labels,
including initial seven-day selection. Corrected14/0, no app fix.
- Docs4 checks/138routes/syntax/diff pass. Test-only, no build/new screenshot/
whole-web/full-product/native/sync/provider/all-backend rerun. Latest whole-web
751312 suites3835 tests; coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF/external
acceptance unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
