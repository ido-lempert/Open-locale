# 0173 - Internal fresh-source local execution

## Developer pass
RepositoryTargetsService internal method copies reviewed input/actor, recomputes
real authorized preview/resolution, requires expected fingerprint and exact draft
SHA256, then invokes existing local composition in one Serializable transaction.
Baseline digest flows from the same captured preview, not a later fresh baseline
that could silently rebind the review. Locked write scope/local generations remain
the commit authority. No automatic retry with stale reviewed bytes. No network
under transaction locks. No controller route invokes the method.

## Product pass
Existing-key locale set/removal only. Remote-only new keys reject before mutations.
No HTTP apply route, baseline advance, remote write, or accepted sync. Remote bytes
are fresh at read time, not reserved against a later repository update. Effects
remain pending and worker defaultOFF.22FULL/7PARTIAL/1MISSING unchanged. This is
execution composition, not external GitHub acceptance or two-way synchronization.

## Designer pass
No UI change. Current native1280x800 editor screenshot inspected directly: EN/HE
columns, saved indicator, memory100% suggestion readable without overlap. Existing
UI evidence only. README/plan name the internal boundary and read-time limitation.

## Security pass
Real signed-in admin authorization precedes repository request. API-token/outsider
attempts denied before actual remote requests. Same reviewed fingerprint/digest
required; no caller file/actor is used. Post-resolution actual baseline replacement,
admin revocation and local generation change deny under locked commit checks.
Seam-reached flags make these negative tests discriminate against earlier denial.
No new registration, credential scope, spend, license or sharing audience.

## QA/integration pass
Sync268->282: wrong choice/digest/fingerprint; outsider/API-token before remote;
actual changed remote read; local generation change during held HTTP response;
actual intent-storage trigger failure rolls back value/history/TM/activity; actual
post-resolution baseline/role/local generation mutations deny; actual target-locale
commit writes value/version/history/activity/TM/pending intent; no baseline advance/
remote write/sync acceptance; replay denied; HTTP route404; no-op has no extra
writes; remote-only new key unsupported. All use real PG, live local HTTP repository
receiver, real auth/preview/reader services. Failure injection is test-only.

Initial fixture used nonexistent TranslationHistory.projectId filter and RC1 after
268passes. Fixed query to key+locale. Expanded fixture had2FAIL from hard-coded
assumed import activity/history counts,not app failure; fixed to measured before
state and key+locale counts.276 then278 then282 clean; full sweep282 and final
cleanup282 clean. No host interruption107. Fixture files cleaned in finally.
API248/30,web48/7,both builds,reaper4RC0.43integration/config legs in14completed
fail-closed batches,all individual/outerRC0;48inventory. Automation116,webhook45,
migration10,sync282/browser98. Native staged116+128=244total/242unique,all242literal
source labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No live fixture descendants or temporary bundles remain.
