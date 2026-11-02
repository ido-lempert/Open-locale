# 0231 - Match recovery execution to review byte bound

## Developer pass
Composition checks archived value UTF8 byte length at32768 after locked recovery
validation and before budget/writer. Domain unsupported maps public400. Guard's
existing512KiB archive bound stays unchanged;the new value bound is separate.

## Product pass
An explicit recovery API cannot execute an archived value that the target review
refuses as too large,even with correctly forged digest/key bindings. Exact32768
bytes stays supported. No new UI,remote write,baseline advance or worker change.
Coverage22FULL/7PARTIAL/1MISSING,worker defaultOFF unchanged.

## Designer pass
No UI change. Actual480x900 fixture screenshot inspected:focused read-only result,
target/path/UTC/no-reservation/no-restore-UI notice and escaped value/controls
readable,no horizontal overflow. First heading partly behind sticky header,second
card below viewport. Screenshot is not a mutation test.

## Security pass
Actual HTTP tests use Hebrew multibyte values:16384characters=32768UTF8bytes,
16385characters=32770bytes. Exact bound review/execute succeeds with one intent.
Oversized review denies with null value,and correctly forged digest/key/revision
execution input returns400,leaving actual recovery counts unchanged and absence
marker retained. Rebuilt old source630pass/1expectedfailRC1 exactly oversized
execution test;restored source/rebuilt631RC0. No privilege-bypass claim:caller
already requires direct admin. Fix prevents inconsistent supported-value bounds.

## QA/integration pass
Sync629->631(+2boundary tests),initial/finalRC0.43unique integration/config legs
in11completed green batches,individual/outerRC0. Browser156,API248/30,web77/7,
both builds,reaper4,138routes allRC0. Migration22,automation132,webhook45.
No startup issues,timeouts/interrupted calls or unrelated failures. Native staged
visual116+128=244total/242unique,all242literal labels present,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. After integrations only docs/
OpenAPI description changed;docs/API build rechecked before commit. No external
acceptance claim.
