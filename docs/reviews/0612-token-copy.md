# Truthful one-time API-token Copy feedback

## Developer review
Separate token handler leaves webhook Copy unchanged. Copies only current reveal;
pending duplicates are refused. A pending operation stays pending through Hide
and replacement Create so two writes do not race. Feedback is scoped by reveal
object identity, project ID and component lifetime. Hide, accepted replacement
and successful matching revoke clear feedback; old completion cannot label them.

## Product review
Silent clipboard refusal is replaced by bounded retry/manual-copy guidance.
Success means browser write acceptance, not pasting or retention. Hide explicitly
warns that pending writes may finish; no promise of cancellation or cleanup.
Webhook Copy feedback is still separate. No API or schema change.

## Design review
Named Copy button with linked scope help and live status; duplicate action is
disabled while pending. Four actual success/failure desktop1278x899/mobile390x844
screenshots inspected20:39, readable and fit. Mobile begins at reveal with panel
heading above viewport. Disposable token screenshot DOM is redacted to same-length
R; actual unredacted mobile overflow assertion runs first. Added failure-width
assertion during review, focused17/0.

## Security review
No raw clipboard error or token bytes in status/logs. No application clipboard
read and no clipboard cleanup. Fixture native write/readback and real Chrome
permission denial use only disposable local read tokens. Held writes wrap the
native writer to exercise late results, not replace success with a fabricated
receipt. Pending writes cannot be canceled and may finish after Hide/departure;
that limitation is explicit. Fixture revokes tokens and clears only its test
clipboard at teardown. No live credentials, worker, registration, spend or license.

## QA review
Twelve new units cover exact bytes, bounded refusal/unavailable clipboard, retry,
pending duplicates, late success/refusal after Hide, replacement, revoke,
project-ID mismatch and actual destruction. Initial units/build RC0 actual web,
APIcached. Browser FIRST15PASS/1FAIL RC1: Hide DOM assertion raced Angular render.
Fixture-only two-frame wait produced16/0. Deliberate removal of reveal-identity
fence produced13PASS/3targetedFAIL RC1; restored16/0. Reviewed failure-width
assertion gives17/0. Related tokenHide15/0/revoke15/0/pending12/0 FIRST RC0.
222 browser suites FIRST2592PASS/0FAIL, all RC0. API a/b/c/d plus
sync-preview644/automations132/2FA37/SAML55 FIRST RC0. Sync95+144=239 and
native116+111+19=246 FIRST RC0, each stage separate; native56042 environment-only,
four startup repeats. Configsync16/native14/docs4/glossary-reset3/runner4 RC0.
Final units/build RC0,2/2cached each; initial actual web retained. Final docs4/
syntax1/diff RC0. No app or fixture changes during broad verification.
Final five-perspective review found no further fixes. Four success/failure
screenshots re-inspected22:58: readable and fit, mobile heading above viewport.
Pending writes may still finish after Hide or departure, as disclosed above. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
