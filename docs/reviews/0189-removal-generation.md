# 0189 - Fence removal effects against absence ABA

## Developer pass
Removal writer stores audit UUID in durable project/key/locale generation row in
same transaction as audit/delete. Composition captures marker on removal intent;
set intents leave null. Eligibility requires exact non-null marker plus absent
locale/current scope. Recreate then another repository removal changes marker,
so older removal cannot become eligible again from absence alone. Marker is not
foreign-keyed to retained audit,avoiding retention-based loss of generation. Project
cascade;one marker per key/locale,not full history. Post-check races remain.

## Product pass
Legacy removal intents have no reliable identity,so migration leaves null and they
fail closed. No invented backfill/replay. Existing newly generated removal still
delivers signed receiver and both checkpoints in HTTP fixture. No remote write,
baseline advance,accepted sync or external acceptance. DefaultOFF unchanged.
22FULL/7PARTIAL/1MISSING unchanged. README/plan updated.

## Designer pass
No UI change. Actual480x900 summary pixels inspected:counts/checkpoints/timestamps
and full notices readable,separate actions,no overflow. Scrolled screenshot starts
at remote-branch metadata,whole summary visible. Browser118 real pointer flows.

## Security pass
Removal identity derived from server-created audit UUID,never caller value. Same
Serializable write transaction rolls marker and intent back together. Unknown or
superseded marker rejects before transport. Existing lease/admin/target/key/locale
checks retained. No private payload stored in marker. No credential scope,spend,
registration,license or audience change. No exactly-once promise.

## QA/integration pass
Sync327->332:legacy-null denial,actual recreate/remove ABA replaces marker while
locale absent and old intent denied,rollback removes new marker/audit,new generation
eligible,rollback restores prior committed marker. Existing fresh removal and
HTTP->signed receiver/both checkpoint tests remain green. Migration13->14 verifies
legacy column remains null/no fabricated markers. Initial327,expanded330,final332RC0.

Old hand-seeded removal adapter fixtures lacked markers:webhook stopped42PASS and
automation39PASS with required failclosed generation error. Fixtures updated with
explicit marker identity;full c45webhooks and standalone132automationsRC0. Those
failed calls left detached fixture children,cleaned by execution wrapper. No app
assertion failure,timeout or startup collision123.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration14,sync332,browser118,
automation132,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded broad verification;fixture updates rerun in own suites. Only this
review added afterward.
