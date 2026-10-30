# 0108 - Update result consistency

## Developer pass
Contents update response already validated path and SHA shape, but not that
returned content SHA matches the exact requested UTF-8 blob. Compute requested
Git blob SHA and require equality before reporting success. Mismatch explicitly
requires reconciliation; no automatic retry because the write may have landed.

## Product pass
This is adapter correctness, not usable GitHub sync. No endpoint, worker,
credential enrollment, baseline storage, journal or application path added.
No real provider update made. Coverage unchanged. A response consistency check
does not independently prove provider authenticity or commit contents.

## Designer pass
No UI change. Future job status needs an explicit uncertain/reconciliation
state, not a green success badge for a malformed/mismatching response.

## Security pass
Git blob SHA matches exact bytes sent, not a second parsed/canonicalized JSON
representation. Fixed origin/auth/pinned connection unchanged. Never retry on
ambiguous success; remote state remains unknown until independently reconciled.
No token disclosure, new credential storage or real remote content operation.

## QA/integration pass
Real HTTP socket regression returns plausible path/40-hex SHAs but wrong blob.
Old code deliberately rerun against this test reports success and fails the
regression. Fixed code rejects with reconciliation message, single request.
Existing success fixture now returns actual requested blob SHA rather than an
arbitrary placeholder. API test count 203 -> 204 in 24 suites. No app UI or
broad visual claim; existing focused browser runs in final sweep.
