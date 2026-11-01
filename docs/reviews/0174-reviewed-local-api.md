# 0174 - Explicit reviewed local-only apply API

## Developer pass
POST apply-local delegates to fresh-source service, not caller file bytes. DTO
requires expectedRevision/fingerprint/choices/exact draft digest. Fresh remote read
outside transaction; existing locked Serializable scope/local generation checks and
atomic value/history/TM/audit/intents reused. No UI action or timer enablement.
Generic transaction/unsupported-operation failures remain500 with rollback; not
uniform409 mapping. Documented explicitly rather than claiming all conflicts409.

## Product pass
Session admin only. Existing-key locale set/removal,never project-key deletion or
other-locale removal. Baseline/remote unchanged,repositorySyncAccepted=false. Fresh
at read time,not remote compare-and-swap. UI remains preview-only;worker defaultOFF.
No two-way synchronization or external-account acceptance. Coverage remains
22FULL/7PARTIAL/1MISSING. Explicit reviewed endpoint does not make preview an apply
permission token or remove the requirement to review exact bytes.

## Designer pass
No UI change. Native current1280x800 editor pixels inspected: EN/HE fields,saved
indicator and memory100% suggestion readable without overlap. Existing UI evidence
only. README distinguishes API capability from preview-only web screen.

## Security pass
Unauthenticated401/member403/outsider404/API-token403 before remote. Required DTO
fields reject400. Forged actor/files ignored by whitelist;actual session actor in
intent verified. HMAC signed removal receipt verified against fixture secret.
Changed remote/503 cannot write. Intent insert failure rolls back all state. No
registration,token scope,spend,license,audience change. Read credential stays exact
repo deployment-managed;publishing token never configured as application reader.

## QA/integration pass
Sync282->295. Real HTTP apply set/removal;no-store/session actor;replay409;mandatory
fields/auth;wrong digest/fingerprint;actual changed remote503 and bytes;actual DB
trigger failure atomic rollback. Removal retains key/base value/deletion audit and
emits actual intent. Processing HTTP-generated queue delivers signed removal to
real receiver,completes both checkpoints,denies two genuinely superseded set-value
intents before delivery. Local fixture only,not external acceptance.

Initial5FAIL: API-token fixture accidentally passed owner JWT through JS default
argument,committed early and invalidated following checks. Changed to explicit null
JWT,then289/293/295clean. Docs suite2FAIL/RC1 found newly implemented route missing
from spec132vs131;added endpoint semantics/session security,full docs batch4RC0.
Combined f1+automation tool timeout120sec after f1five suites completed green;
automation interrupted after112checks. Verified no live descendants,TCP55470free,
lock owner zombie;removed dead socket,standalone automation116RC0. No app change
for fixture/default-arg/timeout mistakes;OpenAPI was actual missing documentation.

API248/30,web48/7,both builds,reaper4RC0.43integration/config legs14completed
fail-closed batches,all final individual/outerRC0;48inventory. Webhook45,migration10,
automation116,sync295/browser98. Native staged116+128=244total/242unique,all242literal
source labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No active fixture descendants/temp bundles remain.
