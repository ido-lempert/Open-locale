# Hide editor tools while translating

## Developer review
Explicit component-local expanded signal, default true, native button with
aria-expanded/controls. Toolbar uses hidden plus component CSS display:none;
DOM remains mounted so form values and pending state are not reconstructed.
Toggle only changes visibility, refuses after destruction. Mouse-down prevents
translation blur on pointer use. No read/save/cancellation/discard or persistence.
Existing keyboard focus movement/blur-save is unchanged. No auto collapse.

## Product review
The tall creation/filter/import/export toolbar can be moved out of the way,
including on390px, while the translation grid stays available. Tools default
expanded every visit. Hiding is not a save or safety/navigation guard. General
notice/error, grid read errors/retry and local backup stay outside. Tool-specific
feedback is hidden with tools; visible collapsed guidance says so and tells users
to reopen to check creation/import/export/branch results. Pending work still
finishes and can affect the editor according to existing behavior. No claim of
all feedback staying visible or hidden operation cancellation.

## Design review
One native Hide/Show editor tools control above toolbar, keyboard reachable,
ARIA reflects current visibility. Collapsed text is direct about hidden feedback
and independent pending work. Desktop/390px actual pixels inspected readable,
wrapped/no document overflow; mobile grid begins within viewport. First capture
scrolled control behind sticky header, fixture scrolls top and recaptures, no app
fix. Desktop captures later saved state, mobile earlier unsaved state. Expanded
toolbar remains tall; no automatic responsive layout or column improvement claim.

## Security review
Pure local visibility. Same controls mounted, original handler guards retained.
Hiding is not an authorization boundary and does not cancel requests. No new
storage, credentials, account, API, worker, license, spend, upload or sharing.
No raw error rendering or private value logging in the new product surface.

## QA/integration review
New3units/fullweb1555/152firstactualRC0;initialwebbuildactual/APIcachedRC0.
Units default/two-way toggle/no read-save, branch/filter/tooldraft/translation/
pending retention and destroyed handler refusal. Focusedfirst8PASS1FAIL because
fixture focused toggle from translation, invoking existing blur-save before
keyboard action. Corrected fixture waits focus/blur network idle before resetting
log and pressing Enter; no app fix. Second/restored9/0, extended10/0 adds actual
390px pointer hide and waits pending export DOM removal, not merely hidden style.
Oldapp0PASSmissingnewtoggleabortRC1/currentrestored/full logs retained. Actual
focused pointer zeroAPI and local value retained; tool DOM drafts retained;
keyboard reopening after normal focus/blur; real held saved-server export stays
pending hidden, finishes and shows retained feedback when reopened. Mobile
collapsed grid within viewport/no overflow/runtime. APIa/b/c/dsyncpreview6442FA37SAML55firstactual0;automations132firstactual0 via12
separatelypreparedunchangedsourcebundles/tempharnessskiponlyesbuildartifactchecks/
assertionssleepsDBunchanged/fresh55891cleaned. Separate sync95+144239unique/native
116+111+19246total242unique4startuprepeats eachfirstinnerouter0. Finalweb1555/152
andAPI265/31bothcached0 afterinitialactualweb0;finalbuildsbothcached0 afterinitial
webactual0. Config16/14/docs4/reaper4first0. All152isolatedbrowser suites finalRC0/
1667assertions,151firstRC0.073webhookdownloadfirst1PASS then missing deliveryDownloadNotice
DOM abortRC1 afteractualJSONpassed;unchangedsecond10/0/noapptestfix/exactcause
unestablished/fullfirstlogretained. No sourcechanges during sweep. Completedchecks
retained across routine pauses; staged equivalence, no uninterrupted-run claim.
Finaldocs/diffcheck beforepush. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
