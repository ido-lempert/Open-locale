# 0221 - Target-scoped read-only recovery review API

## Developer pass
Separate GET repository-targets/:targetId/deletion-audits/:auditId/recovery-review
uses UUID parameters,JWT guard,no-store and existing read-only snapshot review.
Explicit response adds public source/maxValueBytes/historyReplay/snapshotIncluded
flags without leaking full archive or baseline text. No execution endpoint.

## Product pass
Review binds selected target,current audit/key and comparison baseline,not an
execution grant. Direct session admin only,matching current composition. Bindings
are review facts,not secret credentials/tokens. Existing value-only review unchanged.
No UI consumer yet,worker enablement,remote write or baseline advance. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.137routes documented/implemented.

## Designer pass
No UI change. Actual480x900 focused value-review screenshot inspected:full first
card/blue outline/escaped markup/UTC not-live-no-reservation-no-restore notice and
controls readable,no overflow. Second card below viewport. Local fixtures only.

## Security pass
Real HTTP session/API-token/contributor/outsider/group-only-admin denials,each UUID
parameter400,exact top-level/nested response key allowlists,no archived history/full
snapshot/baseline bytes,no mutations on repeated reads. Actual other-project target,
missing target/audit,missing/stale baseline,wrong locale,oversized value and live row
return null value/bindings. No-store negative control rebuilt API:577pass/1expected
fail. Restored source/rebuilt API then578passRC0. Existing snapshot/DB READ ONLY and
authorization revocation tests retained. No new external authority/account changes.

## QA/integration pass
Sync558->578(+20). Initial572green,additional actual HTTP denied-state/cross-project
legs578green. Only intentional negative control failed. All43unique integration/
config legs via10completed green batches plus standalone sync578/browser151,
individual+outerRC0. API248/30,web74/7,both builds,reaper4RC0,migration22,automation132,
webhook45,137routes. No startup issues,timeouts or interrupted calls155. Native
staged116+128=244total/242unique,all literal labels covered,inner/outerRC0,checkpoint
removed. Staged,not uninterrupted. No app changes after restoration;only docs later.
No production/external acceptance claim.
