# 0124 - Explicit sync preview draft resolution

## Developer pass
A pure bounded resolver selects base/local/remote for every differing key,
including one-sided changes, additions and absent values. Unchanged/converged
values need no selection. Rejects missing/extra/invalid choices; sorted JSON
bytes and SHA256 digest, validates combined output bounds. No writes or apply
capability. HTTP endpoint reuses authorized repeatable-read local snapshot and
its scoped row-generation fingerprint, not caller local data. Stale review409.

## Product pass
Session OWNER/ADMIN only. Draft preparation is a step toward conflict resolution,
not two-way GitHub sync. Explicit absence removes a key from draft bytes only.
Caller baseline/remote remain unverified, canApply=false. No repository config,
accepted baseline, import, push or external provider acceptance. No coverage
promotion. No UI for this API in this slice. OpenAPI route initially missing:
docs consistency caught two failures, route documentation added and rerun4/RC0.

## Designer pass
No UI change or resolution controls claimed. Existing sync-preview desktop and
480px screenshots inspected: warning/scope/files readable, comparison table has
its documented horizontal scroll on narrow screens. Sync browser26 checks pass.
New endpoint returns actionable409 stale-review and400 choice/bounds messages;
future UI must preserve selections on transient errors and invalidate on edits.

## Security pass
Existing session/admin/project/branch/locale checks run before local file parsing.
Cannot supply local values, actor or downgrade scoped fingerprint. Write API tokens
rejected; no-store. Flat-map parser still rejects duplicates, dangerous property
names, nested/plural data. Inherited/array choices rejected, absence not empty
string. Digest/fingerprint are diagnostics, never execution permission. No secrets
or external credentials in product code. Output bounds checked after combination.

## QA/integration pass
API217->227 tests,26->27 suites:10 resolver tests. Real PostgreSQL/HTTP sync45->65
checks: choices, absence, exact reviewed draft, no writes/history, no-store,
row edit/revert stale409, remote/branch/locale stale409, invalid/incomplete/extra
choices, forged local ignored, session/admin/outsider/member/API-token boundaries.
Web24/5 suites and both builds RC0; reaper4/RC0.

43 unique integration/config legs in completed fail-closed batches, individual
RC0. Full48-leg inventory includes unit/build/reaper legs. Native visual first116
and second128 PASS =244 total, two repeated startups =242 unique. Both stage
outer/inner RC0; every source assertion label covered, checkpoint removed.
Staged, not uninterrupted. No external acceptance or coverage-count changes.

Verification issues disclosed: combined batches hit120sec during SAML browser
tail; did not count incomplete batch. Dead postmaster left socket55478; verified
zombie and TCP refused before cleanup. Initial SAML/sync retries could not start.
SAML retry had61 passing assertions but reaper RC1 for leftover descendants;
normal SAML rerun61/RC0. Found pre-existing duplicate fixture PG port55478 in
SAML-browser and sync-preview; sync fixture now55482, duplicate-port scan clean.
Final sync65/RC0 and clean completed batch. These are fixture/verification issues,
not application fixes. No test failures were hidden or converted into green.
