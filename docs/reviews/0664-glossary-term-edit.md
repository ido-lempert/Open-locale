# Edit loaded glossary term details

## Developer
Reviewed exact term object, project, route scope and list-generation bindings. Loading, failed reads, replaced rows and unconfirmed row writes block Save. Pending requests block duplicate saves and closing. The PATCH sends only trimmed term and notes. A confirmed response updates only those fields on the exact row and preserves local translations, saved translation comparisons and unrelated forms. A replaced list stays authoritative. Failed requests keep edit text, mark the result unconfirmed and require a read plus reopening rather than replay. Route departure suppresses late results. Review added destroyed/unconfirmed opening guards and a focus-only blur suppression so opening the editor cannot save a focused translation.

## Product
Explicit term and notes editing uses the existing API. Term is 1-200 characters and notes up to 1,000 by its character count; empty notes clears notes. Local text is not autosaved or restored after leaving. Translations and do-not-translate are excluded from the PATCH. The existing functional database index enforces case-insensitive per-project term uniqueness, including renames. The update service currently lacks friendly rename-conflict handling; this slice does not change that error path. Draft downloads do not include this separate edit form, so its scope text tells users to copy before closing. Coverage classification and disabled workers remain unchanged.

## Designer
Inspected desktop, 390px mobile, scrolled mobile and result screenshots. Inputs and controls fit, guidance wraps, and row actions remain reachable. Opening scrolls and focuses the term input. A real-browser assertion verifies this focus transition keeps unsaved translation text without a blur-save. The new-term form remains unchanged.

## Security
Only the bound term ID and two explicit text fields are sent through existing authorization. Plain-text Angular rendering handles markup-looking notes. No new route, schema, sharing, credentials, worker or external destination. Fixed errors do not expose private exception text. Unconfirmed writes never become automatic retries.

## QA and integration
- Focused units: 31 tests passed after final review. Initial development run was 23 pass / 5 fail, catching missing loading/list-error guards, an over-broad refresh reset and one invalid race-test setup; fixed before regression.
- Final planned nonoverlapping web-unit stages: 136 files / 1,669 tests and 136 files / 1,513 tests. Total 272 unique files / 3,182 tests. Staged coverage, not an uninterrupted whole-web run.
- Final real Angular/Chrome/API/PostgreSQL feature suite: 14 checks passed. Initial 12-check run aborted on a screenshot selector cleared by the failed-write step; harness-only selector fix restored 13 checks. Final review added focused-translation preservation, which failed before a focus guard and passed after it. Final feature suite passed again in the affected-suite regression.
- Final negative probe omitted notes from the held PATCH: exactly the persistence assertion failed, 13 pass / 1 fail, exit 1. Probe removed and final normal suite passed. Earlier probe setup failures (module resolution and an unsafe content-length header) were harness failures, not accepted negative-test results.
- Broad pre-final-focus-fix regression: 274 suites / 3,455 passing checks. Suite 064 was interrupted by a runtime timeout, then stopped on its stale PostgreSQL socket lock; verified defunct owner, removed only the stale socket/lock, reran 5 checks successfully. Suite 099 stopped twice before assertions on a fixed-port bind failure, then passed 12 checks unchanged after delay. Separate failure logs retained.
- After the final focus/opening guard changes, all 16 affected glossary browser suites passed, including the 14-check feature suite. The other broad suites are not represented as post-fix reruns.
- All API regression legs passed, including sync preview 644, automations 132, two-factor 37 and glossary 15. An initial combined command timed out during automations; its leftover local PostgreSQL was stopped, then the complete automation suite passed. Sync stages 95 + 144 = 239 and native visual stages 116 + 111 + 19 = 246 passed before final focus changes. Checkpoints removed.
- API units 31 suites / 265 tests passed from cache. Final API/web build passed (web rebuilt, API cached). Docs 4, sync-stage config 16, visual-stage config 14, reset harness 3, runner 4, syntax and diff checks passed.

Local checks do not promote external acceptance. Docker runtime, external delivery/CDN/provider/IdP and production-automation gaps remain. Accepted GitHub two-way remote write/baseline advance remains missing. No worker enablement, spend, registration, token-scope expansion or license choice.
