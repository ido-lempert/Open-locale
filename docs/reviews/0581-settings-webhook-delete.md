# Guard webhook deletion confirmation and pending state

## Developer review
Match confirmingHook to existing target before delete, block busy direct calls.
Ask/cancel use busy guard. Accepted DELETE filters only target before reload,
clears matching reveal, closes confirmation and records saved result. Refusal
keeps list/confirmation/reveal for explicit retry. Independent drafts stay.

## Product review
Deletion cannot use another hook's confirmation. Pending cancel does not promise
abort. Review found initial receipt incorrectly implied history preservation;
existing schema cascades selected history. Corrected receipt and pre-delete
warning explicitly include history and irreversibility. Other hooks remain.

## Design review
Named start/confirm/cancel buttons preserve existing layout, disabled busy.
1278x899 desktop and390x844 mobile confirmation and accepted-state pixels
inspected after full regression: warning includes irreversible history deletion,
confirm/cancel and receipt fit; other-hook controls stay available. Receipt and
form fit without overflow. Other-hook URL above mobile view. Matching deleted
secret absent; URL draft stays.503 error below view; list has accepted fallback.

## Security review
Disposable local webhook rows only, no external receiver calls/worker change,
real credentials/account/spend/registration/license change. Two history rows
seeded directly, no delivery emitted; selected history cascades, other stays.
UI confirmation supplements unchanged backend admin checks, not authorization.

## QA review
Six new units first webactual/APIcachedRC0. Enclosing combined command timed out
after completed units, first build interrupted. No process remained; resumed
build webactual/APIcachedRC0. Review-updated units/build sameRC0.
Focus first8PASS1FAILRC1 because text assertion expected was deleted after receipt
changed to were deleted; corrected fixture only9/0. Confirmation-guard removal
negative0PASS2FAILRC1. Expanded restored10/0 adds selected-history cascade and
other-history preservation, no assertions dropped. Actual DELETE then503 keeps
accurate local/server removal, reveal clear and other draft;403/direct/wrongtarget/
cancel/pending guards. Zero tasks/translations; one remaining seeded history,
no emitted deliveries/runtime errors. Confirmation warning corrected after first
restored focused run; updated units/build and broad207 cover current app text.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239/native116+111+19=246 firstRC0, native stages each their own call,
PG55968. Config16/14/docs4/glossary harness3/runner4 firstRC0.
Browser001..207 final2348PASSzeroFAILRC0,206 first-run passes, each suite own call.
031 first0PASS1FAILRC1 before assertions: PostgreSQL55544 address in use. Later
probe connection-refused111, retry16/0; no process killed or app fix. Failed log
preserved. All other broad suites firstRC0. Results preserved across run boundaries,
not an uninterrupted run. Final focused fixture adds only confirmation screenshots
and corrects header comment, no assertions changed;10/0. All four latest pixels
inspected. Final web/API units/build cachedRC0; docs4, script syntax and diff checksRC0.
Coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.
