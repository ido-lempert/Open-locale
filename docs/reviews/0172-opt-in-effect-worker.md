# 0172 - Default-off repository effect worker

## Developer pass
Nest module wires existing combined step to one 5-second tick per process. Exact
true opt-in only; duplicate init and in-flight overlap guarded, timer unrefed.
Review caught missing signal hooks and premature Prisma module-destroy disconnect:
fixed SIGTERM/SIGINT hooks, BeforeApplicationShutdown worker drain, and
OnApplicationShutdown Prisma disconnect. Actual Nest process signal test proves
work finishes before disconnect. Errors logged generically, runner owns retries.

## Product pass
Default OFF. Only processes already queued local-effect intents, not remote writes
or public apply. No baseline advance or accepted repository sync. Lease/checkpoints
remain handler bookkeeping. Crash gaps still permit duplicates; forced termination
can interrupt drain. Deployment grace must allow in-flight work.22FULL/7PARTIAL/
1MISSING unchanged. No external account acceptance claimed.

## Designer pass
No new UI. Current1280x800 native editor screenshot inspected directly: EN/HE
columns, saved indicator and memory100% suggestion readable, no overlap. Existing
UI evidence only. README states default, opt-in, signal drain and forced-kill limit.
Removed stale plan/step claims that there was no worker timer.

## Security pass
No public enable switch or apply route. Existing per-effect lease, intent, target,
rule, role guards remain; explicit deployment env opt-in required. Serial local
work does not imply exclusive global processing or exactly-once delivery. Generic
warning avoids leaking effect bodies. No credentials, scopes, spend, license,
registration or audience changes. DefaultOFF untouched outside test fixtures.

## QA/integration pass
Automation109->116: disabled actual pending row; enabled actual signed receiver,
task/both checkpoints; shutdown blocks later claims; held real socket prevents
local overlap and delays drain; releasing socket resolves drain; actual Nest child
SIGTERM remains leased/alive past5sec then finishes actual task/both checkpoints
before exit. Receiver keepalive prevents idle timeout from faking a held socket.
Initial112,expanded114 clean; lifecycle order corrected,114 rerun clean; actual
signal legs added,final116 clean. Final API248/30,web48/7,both builds,reaper4RC0.
43 integration/config legs all final RC0,48 inventory including units/builds/reaper.
Webhook45,migration10,sync268/browser98. Final native staged116+128=244total,
242unique/all242literal source labels covered,inner/outerRC0,checkpoint removed.
Staged,not uninterrupted. Broad sweep/native repeated after lifecycle correction.

Failure chronology: earlier reports fixture startup RC1/zero checks PG55466 busy,
then bind-free/full batch rerun clean. Final combined2FA/OIDC call exceeded120sec:
2FA37 passed,OIDC interrupted mid-checks. Retry startup saw dead orphan PG55477
socket: underlying script RC0/FAIL, wrapper correctly RC1 with zero passes. Removed
verified dead socket and terminated only orphan fixture web/browser, bind-checked
ports, standalone OIDC49 RC0 then remaining browser legs RC0. No app change for
port/interruption. Mistyped nonexistent npm test:reaper alias RC1/no checks,
correct Python fixture4RC0. No failures hidden or treated as passes.
