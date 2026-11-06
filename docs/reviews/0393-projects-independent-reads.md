# 0393 - Independent project list and account-status reads

## Developer review
Project and two-factor status use independent loading/error/read generations.
Both settle only their current generation and stop after destroy. Initial reads
start together, while list reload after creation does not refetch status. Retry
status clears old state before reading; failed read never implies disabled.
Status refresh blocked during existing shared mutation busy state; ordinary UI
shows retry only after read failure, hiding settings form until status succeeds.
No mutation behavior redesign, request cancellation or outcome reconciliation.

## Product review
Pending/failed list cannot show No projects yet. Fixed messages distinguish list
access/connectivity from unavailable account-security status. Each retry fetches
only its own resource. A working list remains available despite failed status,
and a working settings form remains available despite failed list. Mutation error
messages/creation handling remain separate and unchanged.

## Designer review
Desktop loading, independent status failure, list failure and ready pixels
inspected. Alert/retry and project cards readable without clipping. Security
read-failure guidance says no setting changed by this read, not that account
settings can never change elsewhere. Existing visual layout preserved; not a
full mobile or accessibility audit. Loading/error/empty states distinct.

## Security review
Neither read exposes raw backend error or mutates settings. Status unknown hides
setup/disable form instead of claiming disabled. Read generations cannot publish
after destroy or overwrite newer response. Existing mutation authentication and
server protections unchanged; no external identity/worker/credential scope change.
Recovery codes, setup-secret storage and mutation-failure recovery not redesigned.

## QA/integration review
API265/31 web398/27 (+7) uncached/builds0 initial420.40kB below500budget.
Browser7 proves held list/no false empty, independent errors/no raw detail,
resource-specific retries, real project/status recovery, route-away late response
and zero security mutations. All62 bounded integration/config legs final0,
config16/docs4-138routes/reaper4. Initial ota/incontext/incontext-edit/oidc/groups
batch had all inner0 but reaper live-descendant forced-cleanup warning; equivalent
full batch clean rerun inner/outer0, original log retained. No failed application
check or timeout. SyncSTAGED95+144239unique/nativeSTAGED116+128244total242unique
inner/outer0, checkpoints removed, no app/test edits after native. Not canonical
uninterrupted. Docker static-only, coverage22FULL7PARTIAL1MISSING/defaultOFF and
external acceptance limits unchanged.
