# Token Revoke loaded metadata review

## Developer
Reviewed fresh scope membership array, preserving full raw values/order/duplicates without mutation. Raw loaded timestamp strings avoid timezone conversion or expiry calculation. Existing confirm/handlers/API unchanged. No extra read/dependency.

## Product
Exact ID, scopes and created/last-use/expiry metadata distinguish same-name tokens. Null timestamps explicitly absent loaded metadata, not a validity or complete-use claim. Local-only/no newer-server/current permission/validity/usage/dependency promise. Confirm still targets ID only; copies not erased.

## Designer
Full wrapped escaped text in new panel and existing token metadata spans. Actual desktop/390px confirmation top+bottom/result pixels inspected before commit. Full300-character scope/ID/raw timestamps wrap, controls readable. Mobile scrolling required, not one-screen claim. Initial name/destructive warning above captured review viewport. Accepted503receipt/unsentdraft retained.

## Security
No secret display/link/image/token request/scope change/copy. Existing explicit confirmation/busy/server guards retained. Extended scopes/timestamps injected local metadata then restored before actual API deletion, not unknown-scope remote acceptance. Actual selected token401 after revoke, same-name other token200 and row survives. Refusal retains both tokens; held delete prevents duplicate effects; no tasks/translations/deliveries.

## QA
9newunits actualweb109s/APIcached FIRST0/build15.9s FIRST0. FocusFIRST21PASS0; harness-only sorted/deduped scope override20PASS1targetedFAILexit1/restored21PASS0, removed. No app fixes. APIallbatches FIRST0 including644syncpreview/132automations/37twofa. Sync95+144=239/native116+111+19=246 PG56123 FIRST0 each stage own call. Config16/14/docs4/harness3/runner4 FIRST0. Broad258FIRST exit0,3216PASS0FAIL across saved run boundaries, each suite own call, no exceptions/retries/appfixtureedits. Finalcachedunitsbuild0. Staged verification, not canonical uninterrupted-run claim. Docs/syntax/diff checked before publication.

Coverage22FULL/7PARTIAL/1MISSING/workersOFF/external acceptance gaps unchanged. No registration/token scope expansion/credential change/spend/license choice.
