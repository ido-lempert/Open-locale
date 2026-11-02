# 0223 - Avoid unused baseline bytes in recovery review

## Developer pass
Target recovery review selects required target fields,branch project/name and
baseline version/revision/SHA/digest only. It no longer includes full baseline row
or unused target/branch fields. No API/UI contract change. Existing snapshot remains.

## Product pass
Read-only review never uses baseline text;loading it wasted transfer/memory. No
recovery execute route/UI,worker enablement,baseline advance or remote write added.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Current480x900actualpixels inspected:entire focused result region,
wrapped target/path/UTC/no-reservation/no-restore notice,escaped value and controls
readable,no horizontal overflow. Card header begins partly behind sticky header,
second card below viewport. Local fixtures only.

## Security pass
Large1.1MB private baseline fixture with actual Prisma transaction delegate result
and emitted SQL proves only4required baseline scalar fields cross DB boundary.
No unused text in result or SQL projection. Negative broad include restores old
behavior:578pass/2expectedfail exactly projection and emitted-SQL assertions.
Restored source then final580passRC0. This bounds transferred fields,not database
storage size/scan cost. No account/credential/scope expansion.

## QA/integration pass
Sync578->580(+2),initial/finalRC0. No failures outside intentional negative control.
All43unique integration/config legs via9completed green batches plus standalone
sync580/browser156,individual/outerRC0. API248/30,web77/7,both builds,reaper4RC0,
migration22,automation132,webhook45,137routes. No startup issues,timeouts/interrupted
calls157. Native staged116+128=244total/242unique,all literal labels covered,inner/
outerRC0,checkpoint removed. Staged,not uninterrupted. No app changes after source
restoration,only docs later. No production/external acceptance claim.
