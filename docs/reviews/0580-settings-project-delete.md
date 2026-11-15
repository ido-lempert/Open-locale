# Guard project deletion confirmation and pending state

## Developer review
Explicit ask/cancel methods refuse busy state. remove requires confirmation,
not busy, and no accepted deletion. Clear prior error only on actual submit.
Accepted DELETE latches before navigation and closes confirmation; later failure
does not turn accepted deletion into a retry. Server refusal keeps confirmation
and drafts, unlocks for explicit retry. No API/schema changes.

## Product review
Destructive action needs deliberate confirmation and cannot overlap other busy
work. Cancel before submission requires new confirmation. Pending Cancel is
blocked, not a promise of abort. Navigation failure after accepted deletion needs
its own state, not another destructive retry. Review found this and added the
accepted latch plus return link; local fields explicitly no longer saved state.

## Design review
Existing danger-zone warning/action text kept. Start/confirm/cancel named for
consistent checks.1278x899 desktop and390x844 mobile pixels inspected: destructive
warning and disabled buttons fit. Separate390px accepted-deletion fallback
notice, return link and navigation error fit without overflow. Earlier local
project-name draft differs from saved name in deletion warning by design.

## Security review
Only disposable local PostgreSQL projects deleted; no production account/data,
worker, credential, spend, license or registration change. UI guards supplement
existing server authorization, not a replacement. No backend capability expansion.
No claim that pending DELETE can be canceled or server deletion undone.

## QA review
Six new units first web actual/API cached RC0, first build same. Review then added
accepted latch/navigation recovery; updated units/build web actual/API cached RC0.
Focus initial9/0; negative removing confirmation guard0PASS2FAIL RC1 at unconfirmed
DELETE. Expanded restored11/0 covers accepted navigation failure, retry-blocking,
return link and second project's normal automatic navigation. Pending/direct/
button/cancel,403 retry and preserved drafts, actual PostgreSQL deletion of both
projects; zero tasks/translations/deliveries and runtime errors. Count9->11 is
expanded recovery coverage, not dropped assertions. No unintended failing run.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239/native116+111+19=246 firstRC0, native stages each their own call,
PG55968. Config16/14/docs4/glossary harness3/runner4 firstRC0.
Browser001..206 FIRST2338PASSzeroFAILRC0, each suite own call. Completed results
preserved across run boundaries, not an uninterrupted run. Final web/API units
and builds all cachedRC0; docs4, browser-script syntax and git diff checksRC0.
Latest three desktop/mobile pixels re-inspected after206, warning/buttons and
accepted fallback/link/error fit as noted above. Coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.
