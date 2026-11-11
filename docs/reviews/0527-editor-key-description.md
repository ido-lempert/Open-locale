# Read loaded key description while translating

## Developer review
Native per-key details around existing loaded description, no new component
state or TypeScript behavior. Truthy description only; empty/absent has no
control. Angular interpolation, pre-wrap and anywhere wrapping. Pointer summary
prevents translation blur-save; native keyboard behavior retained. Existing key
read/replacement/generation and inert failure/loading grid boundaries unchanged.
No extra read, metadata edit, backup schema or API/storage change.

## Product review
Description guidance already arrived with keys but editor did not show it.
Translator can now open it next to the key while editing. Adjacent copy says
loaded read, not fresh or save confirmation, and reload can discard local work.
Newer unread server description stays unread until explicit current key read.
Not a description editor, freshness guarantee, per-translation context, history
or safe reload feature. Empty description does not imply no comments/screenshots.

## Design review
Native collapsed Key description summary under key name; only expanded text
adds height. Multiline description stays readable, unbroken strings wrap on
390px. Desktop/390px actual pixels inspected literal markup/readable/no overflow.
Long description naturally creates a tall row; not a row-height improvement.
Pointer doesn't move focus from translation; normal keyboard focus movement may
still invoke existing blur-save. Keyboard Enter collapse/reopen verified.

## Security review
Interpolation only, no innerHTML. Actual stored img markup renders text/no image
node. Already-authorized loaded description only, not arbitrary objects or
extra API/private retrieval. No upload/sharing/account/worker/spend/license/
credential scope changes. Existing inert retained grid keeps failed-read context
read-only. No claim that description was freshly verified or local draft saved.

## QA/integration review
Template/CSS only, no new unit count claim. Initialwebbuildactual/APIcached0.
Focusedfirst10/0;oldapp0PASS2FAILmissingdetails/missingtoggleabortRC1;current
restored/extended12/0/full logs. Real PG stored multiline Hebrew/markup/long text,
empty second key exclusion, dirty translation pointer expansion zeroAPI/no blur
save, exact literal text/no injected img, newer unread server change stays old,
390px wrap/no document overflow, keyboard collapse/reopen zero action requests,
explicit current key read installs newer description, failed superseding real
branch read retains prior description inside inert grid, current empty removes
old context. Fixture reload discards already-checked draft, not product safe-reload
acceptance. Keyboard test waits prior focus/blur traffic before resetting action
log, no keyboard-focus-save suppression claim.

Broad regression: full web/API unit targets RC0 (web actual, API cached),
final web/API production builds both cached RC0 after initial actual web build.
API groups a/b/c/d, sync-preview644, 2FA37, SAML55 all first RC0. Automations132
first RC0 using twelve separately prepared unchanged-source bundles and a
temporary harness skipping only esbuild after artifact checks; assertions,
sleeps, PostgreSQL and HTTP unchanged; fresh55899, temporary artifacts removed.
Sync95+144=239 unique and native116+111+19=246 total (242 unique, four repeated
startup checks) all first inner/outer RC0 in isolated stages, checkpoints cleaned.
Config16/14, docs4, reaper4 RC0. All154 browser suites first RC0, 1697 PASS
assertions, zero FAIL, no app/test changes or retries during the sweep. Staged
verification, not an uninterrupted canonical run. Final docs consistency4/0.
Only a misleading copied test-header comment was corrected after the sweep; no
executable source changed. Owner originals/live todo and exact public repository,
default main, push permission, origin and matching remote base checked before push.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptancegaps unchanged.
