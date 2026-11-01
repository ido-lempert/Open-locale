# 0162 - Automation notify guards at actual socket boundary

## Developer pass
Extract existing per-rule checks into closure and pass it through runRule to the
webhook pipeline's existing beforeAttempt hook. Current repository intent and
captured rule revision are checked after DNS and every retry backoff, not just
before entering aggregate. Normal callers also get captured-rule freshness per
notify socket. No locks held across transport. Existing webhook subscription
freshness/signing/pinning/journal remain shared, not reimplemented.

## Product pass
Failed first receiver attempt followed by target/lease/rule change prevents another
socket with stale authority/config. A prior failed attempt still happened and is
journaled; this is not a receiver receipt, rollback, retry deduplication or overall
sync completion. No enabled worker/public execution/baseline advance/remote write/
external acceptance. Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI/control added. Current native1280x800 editor screenshot inspected: locale
columns, saved state and memory suggestion readable without overlap. Existing UI
evidence, no new visual-feature claim. README/plan explain transport boundary.

## Security pass
Guard runs before every actual socket including retries, after DNS/backoff. Real
local receiver returns500 and changes actual PG target revision/lease deadline,
or sends authenticated disable/restore PATCH to captured rule. All suppress second
socket. Point-in-time checks still permit post-check races; per-locale MT guards
and per-rule retry deduplication remain separate code work. No registration,
credential scope, spend, license or audience changes.

## QA/integration pass
Automation55->62: each of three real receiver mutation cases checks exactly one
socket and failed journal attempts1, then verifies first socket HMAC/event and
nonempty abort error; rule ABA additionally verifies authenticated revision+2.
Uses bundled actual automation/webhook services and PG, real TCP receiver, not
transport doubles. Existing explicit MT/notify summary failure doubles remain
labeled and are not external acceptance. Fixture mutation errors return500 and
mutation flag/revision/journal conditions fail closed.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 clean
fail-closed batches,all individual/outerRC0;48 inventory. Webhook45,migration10,
sync268/browser98. Native116+128=244 total/242 unique,all242 literal source labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. No failing
test or host interruption96. No active fixture services/temp bundles on completion.
