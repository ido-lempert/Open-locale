# Edit loaded glossary do-not-translate choice

## Developer
Extended the existing exact-row/project/list/visit binding with the original boolean. Opening copies it; closing, success and route reset clear only editor state. Save includes the boolean only when changed, including explicit false, and updates the confirmed row field without replacing local translations. Unchanged booleans are omitted to avoid overwriting a newer server choice during a text-only edit. Pending and unconfirmed guards remain unchanged.

## Product
Existing terms can now change their do-not-translate choice rather than requiring deletion/recreation. Save remains explicit. Scope text identifies the changed field and excluded translations; new-term form is separate. A stale or failed save retains the local choice and never replays automatically. No server route or schema change.

## Designer
Inspected actual desktop,390px mobile and scrolled-mobile editor screenshots. Initial checkbox inherited global block/width styling and appeared separated from its label. Added a narrow flex/auto-width style; reran browser suite and re-inspected pixels. Checkbox and label now align on one line, controls fit, and local translation text stays visible. Existing focus-preservation behavior passed.

## Security
Explicit boolean only, sent to the existing authorized term endpoint. Original boolean participates in stale-object checks. No translations, credentials or unrelated fields are added. Existing fixed errors and unknown-write handling remain. No sharing, new network destination or permission change.

## QA and integration
- Focused units34/0: true and false persistence, omitted unchanged boolean, stale-original rejection and failed-save choice retention included.
- Planned nonoverlapping web-unit stages:136 files/1,672 tests plus136 files/1,513 tests =272 unique files/3,185 tests. Staged, not uninterrupted whole-web coverage.
- Feature real-browser suite17/0, restored17/0 and final style-fix17/0. Verifies explicit true save/badge, stored checkbox on reopen, explicit false save/badge removal and no translation payload, alongside prior text/unknown/focus guards.
- Negative probe dropped the boolean from intercepted PATCHes. It failed the three dependent choice assertions:14 pass/3 fail,exit1. Probe removed; normal17/0 restored. Multiple expected downstream failures are not claimed as a single-target negative test.
- All16 affected glossary browser suites passed,193 checks including feature17. This precedes the checkbox-only style adjustment; final feature17 passed afterward. No whole-product browser/sync/native rerun claimed.
- Real PostgreSQL/HTTP API glossary29/0, including create/rename races. API/web build passed before final style adjustment; final web build and docs/syntax/diff checks recorded at closeout.

Five perspectives found no remaining issue after the visual fix. External-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING,disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
