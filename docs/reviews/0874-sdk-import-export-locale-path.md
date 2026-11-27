# SDK import/export locale path encoding

## Developer
Encode locale path component in translation reads, imports and format exports;
encode export format component too. Existing query builder still owns branch
and dryRun. Translation write locale is JSON body and not changed. Project/key
components on non-OTA helpers are not claimed audited in this slice.

## Product
Query-like locale previously redirected an import into another branch and
returned branch values through read helpers. Literal component encoding now
prevents that scope change. Unsupported literal import locale rejects; read
endpoints currently permit unknown locales as empty results, preserved here.

## Designer
SDK routing-only fix, no visible UI/screenshot claim.

## Security
Real regression shows wrong-branch write under caller's existing authority,
not an authorization bypass. Rejected import leaves branch values unchanged.
No worker/license/provider/token scope/spend/sharing or registry changes.

## QA/integration
Baseline real SDK/HTTP exactly5 failures: translation read/import/export locale/
export format scope cases and stored unexpected branch key. After fix two
assertions initially expected4xx on unknown read locale; source behavior returns
empty data instead, so assertions now check no branch content, not a false4xx
claim. Fixed SDK51 checks (46prior+5new) pass, OTA117 rerun green. Syntax/diff/docs
pass. No build/unit/browser/native/provider rerun claim. Latest807 API34/318,
804 OTA browsers85, whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external
gaps unchanged. Five review perspectives complete before commit.
