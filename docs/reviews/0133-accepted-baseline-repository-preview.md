# 0133 - Accepted baseline repository preview API

## Developer pass
New target preview joins stored accepted baseline, existing repeatable-read local
DB scope snapshot and fresh verified repository bytes. No caller raw files.
Shared local reader keeps bounds/plural handling/row-generation fingerprint.
Final fingerprint adds target identity/revision/coordinates and baseline version/
SHA/digest. Rechecks admin,target,baseline after I/O. No writes or baseline advance.
Local preview service exported/reused, no duplicate local snapshot implementation.

## Product pass
Comparison only, canApply=false. Source identifies accepted-baseline repository
preview, both sources verified under their respective contracts. Accepted means
explicit selected remote comparison bytes, not local=remote or completed sync.
Missing baseline fails before remote read. Conflicts/deletions remain manual.
No apply, import, remote write, sync record or baseline advancement. No UI yet,
provider acceptance or coverage promotion. README documents actual API semantics.

## Designer pass
No UI change, existing baseline/read UI74 browser checks retained. New errors
identify missing accepted baseline, target reload, changed baseline review-again.
No new screenshot or repository preview UI claim.

## Security pass
Session/admin before target or network access, no caller local/baseline/remote
values trusted. Scoped deployment reader retains fixed origin/credential rules.
Post-I/O baseline version/digest and target revision checks suppress stale plan.
No-store values, no persistence. Fingerprint is diagnostic, never apply authority.
No enrollment, expanded scope or external effect during this work.

## QA/integration pass
Real DB/HTTP sync122->133: missing baseline before I/O, exact accepted-base/local-
DB/fresh-remote composition, forged body files ignored, changed remote fingerprint,
no baseline advance/local or history writes, no-store, role/token/stale denial,
held baseline version change suppresses stale plan, identical local text/new row
generation alters fingerprint. Existing reader/acceptance tests retained.
API244/29,web41/7 unchanged; both builds/reaper4 RC0.43 integration/config legs in
nine completed fail-closed batches all individual/outerRC0, units/builds/reaper
provide48-leg sweep inventory. Native visual116+128=244 total/two repeated
startups/242 unique, every source assertion covered, both stage inner/outerRC0,
checkpoint removed. Staged, not uninterrupted. No failures/interrupted checks
this slice. No active test services retained.
