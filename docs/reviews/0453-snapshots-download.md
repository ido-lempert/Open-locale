# 0453 Download loaded snapshot inventory

## Developer review
Explicit metadata whitelist of all loaded rows independent of label search;
readiness rejects initial/pending/failed read, pending capture/restore, unknown
capture/restore outcome and destroyed handler. Current successful read restores
loaded readiness, but unknown/pending guards remain independent. Read/mutation
start clears earlier notice; temporary Blob URL released after click failure.
No API/schema/dependency change.

## Product review
Local metadata inventory includes IDs/labels/counts/timestamps/automatic flag,
not snapshot bodies, keys or translation values. Private labels and IDs are
explicit. File states restorable:false. Not complete history, newer server state,
backup recovery or proof of capture/restore completion; no automatic reads,
captures/restores/sharing. Requested does not mean saved.

## Design review
Actual desktop/390px pixels inspected and sent: button/scope/notice/search and
snapshot row remain readable without horizontal overflow. No visual correction
needed. Metadata-only and not-restorable scope visible beside download.

## Security review
Whitelist excludes unknown snapshot body/creator metadata. JSON preserves literal
quotes/newlines/markup as data, no executable HTML/spreadsheet. Unconfirmed capture
or restore cannot export apparently current inventory. No external services,
worker, account, spend or credential-scope changes. Owner upload request and live
repository/remote state checked independently before upload.

## QA/integration review
New unit11/web895 in83 suites/API265 in31/builds0. Real browser11/0 exact loaded
file despite local search/newer unread snapshot, translation exclusion, zero
export API effects, pending/failed/current/empty-project lifecycle, real capture
committed then dropped response/export pause, bounded local failure and departed
handler. Initial browser aborted before assertions: fixture assumed2 rows but
import creates an automatic snapshot; fixture now derives expected count from
seeded API list. No app fix. All API/80 isolated browser suites final0. Separate
sync95+144=239unique/native116+111+19=246total/242unique/four startup repeats,
inner/outer0; config16/14/docs4-138routes/reaper4 all0. Completed checks preserved
across continuation, no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/
defaultOFF unchanged.
