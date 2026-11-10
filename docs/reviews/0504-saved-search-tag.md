# 0504 Exact key tag filter for saved text search

## Developer review
Uses existing listKeys tag parameter, exact PostgreSQL array membership alongside
status/selected locale and saved-value predicates. Blank omits tag; bounded40
characters preserves the existing API contract. No trimming or case conversion.
Search captures tag before await, tag edits clear results and generation-fence
old responses; project reuse resets it and departure refuses edits. No backend,
request count, mutation, storage, dependency or worker changes.

## Product review
An exact tag narrows saved text to a release or workflow group without leaving
Find saved text. Scope copy explicitly distinguishes literal case-insensitive
text matching from exact case-sensitive tag membership. Spaces remain significant;
blank restores any tag. A saved-text query remains required. No tag discovery,
tag editing, plural-form search or complete-project export is implied. Existing
loadedmetadata/base-only/nonpaginated/snapshot limits remain.

## Design review
Actual desktop and390px pixels inspected, including scrolled mobile result.
Tag input has its own label; form wraps without overlap or horizontal overflow.
Count names tag scope and empty copy includes it. Target/source context remains
readable. The form is taller on mobile, requiring scrolling to results; no
content is hidden or truncated.

## Security review
Existing authorized list query only. Exact tag enters URLSearchParams, server
Prisma membership filter and Angular escaped output. Actual punctuation fixture
is literal, not a wildcard; no dynamic markup, SQL or new audience. Old private
results clear on tag edit and held old-tag response cannot restore them. No
account/credential/registration/token-scope/license/spend changes.

## QA/integration review
New8units/web1359 in132/API265 in31(cached); builds0(APIcached). Initial/final
focused12/0 actual PostgreSQL tag/status/value intersection, case/space precision,
literal wildcard/backslash tag, blank omission, manual1GET/zero writes, edit
clear/held late fence/mobile/runtime. Intentional oldapp0PASS1FAIL abort on absent
tag input; actual full log retained, restored current/final12/0. No app/test fix
from discriminator. Added scrolled mobile screenshot evidence before final run.
API groups a/b/c/d, sync-preview644,2fa37,saml55 completed first-attempt0.
Automations first command hit its limit after129PASS/noFAIL, before final checks
and completion/exit; not counted as passed, full interrupted log retained.
Prepared12 unchanged-source bundles separately, then a temporary invocation
skipped only those build commands when files existed; all132 checks, sleeps, DB
setup and cleanup unchanged. Its first launch aborted0PASS on stale socket lock
referencing a defunct PID after timeout; full log retained. Existing fixture-port
override55805 then completed132PASS/noFAIL/exit0. Temporary invocation/artifacts
removed, no app/test source changes for recovery. Separate sync95+144=239unique and native116+111+19=246total/242unique with four
startup repeats completed, each stage first-attempt inner/outer0. All131 isolated
browser suites first-attempt0,1416 assertions/no failed assertions or source
changes during sweep. Config16/14/docs4-138routes/reaper4all0; final docs checked
after this evidence update. Completed results preserved across continuations,
staged not uninterrupted. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
