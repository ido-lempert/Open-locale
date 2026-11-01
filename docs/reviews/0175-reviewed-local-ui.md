# 0175 - Reviewed local apply UI

## Developer pass
Typed API helper forwards revision/fingerprint/exact draft digest/choices. Separate
confirmation required;captured request scope sent once,busy prevents duplicate UI
submit. Generation fences late responses after route/destroy. All outcomes clear
comparison/draft/choices/confirmation;uncertain network result warns that writes
may already have committed and demands fresh comparison,never blind retry.

## Product pass
Confirmation names project ID,branch,locale,set/removal counts and SHA256;explains
locale-only deletion,unchanged repository/baseline,no completed sync and possible
later webhooks/automations if worker enabled. Cancel keeps values. No changes hides
apply. Existing-key operation limit remains. Worker defaultOFF,no remote writes,
baseline advance,external-account acceptance or two-way sync.22FULL/7PARTIAL/
1MISSING unchanged. Local apply now available in web UI,not merely an API.

## Designer pass
Inspected actual updated desktop1278x899 and narrow480x900 confirmation pixels.
Digest wraps,scope and effect warning readable,buttons separated with flex gap and
wrap. First screenshot review found touching action buttons and result offscreen
after review collapsed: fixed gap and scroll-to-top after result,re-ran browser108
and inspected narrow success screenshot with visible result. No document overflow.
Tables retain own horizontal scroll. No screenshot-only claim about functionality.

## Security pass
UI calls existing session-admin API only after explicit confirmation. Backend
recomputes sources;UI does not grant provenance/authority. Choice/scope changes
clear confirmation. Late successful apply may still commit original authorized
project after navigation but cannot display old feedback in new project;verified
both sides. Hostile strings remain interpolation/text,not markup. No new secrets,
account registration,scope,spend,license or audience changes.

## QA/integration pass
Browser98->108: scope/count/effect confirmation;cancel no mutation;narrow fit;stale
remote denial clears review;actual set+clearing;other-locale/baseline unchanged;
removal scope;actual removal retains key/other-locale/audit;late successful apply
feedback fenced;original-project-only commit verified. Actual Angular/API/PG/local
repository receiver. Web48->52/7: confirmation+exact binding,error uncertainty,
choice invalidation,late navigation tests. API248/30,both builds,reaper4RC0.
43integration/config legs14completed fail-closed batches,all individual/outerRC0;
48inventory. Automation116,webhook45,migration10,sync295/browser108. Native staged
116+128=244total/242unique,all242literal source labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. No live fixture services/temp bundles.

Initial browser harness failure after96passes raced Angular cancellation render;
added selector wait. Next run97passes then confirmation screenshot raced render;
added confirmation selector waits. Next102passes then new actual DB assertion found
Prisma fixture client uninitialized;connected real fixture client. Final108clean,
reviewed visual fixes108clean,full sweep108clean. App changes for visual findings,
not harness timing/client errors. No host interruption109.
