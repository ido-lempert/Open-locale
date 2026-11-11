# Preserve translation work when filtering keys

## Developer review
Native key-name, tag and review-status filters share the existing translation
work guard, and handlers check before changing filter signals. Rejected native
input/change events restore the prior displayed value. Clear refuses too.
Debounce rechecks before issuing a read; existing synchronous keysLoading and
inert grid prevent user edits during the delay/read. Existing read generation
fencing remains. No reload semantics, backend, storage or automatic save change.

## Product review
Protects these three key filters only. Save drafts and wait for pending work;
copy retained values before explicit reload for an unconfirmed result. Other
navigation, browser close/reload and other local form edits remain outside scope.
Clean filters and superseding pending reads continue normally. This is not
persistent draft storage or a global navigation guard.

## Design review
Native disabled inputs/select plus adjacent guidance and aria-describedby.
Desktop and390px screenshots inspected: values and guidance readable, wrapped,
no overflow. Existing taller mobile toolbar/grid below fold remains. No mobile
layout improvement claim. Existing branch/find guidance retains its own scope.

## Security review
Local data-loss guard, not authorization. Forced disabled input/change events
cannot alter filter state or start reads. No private text enters URL/logs, no new
write, account, credential, worker, provider, storage or external disclosure.

## QA/integration review
New20units cover each filter against dirty base/plural, saving, reviewing and
unknown state, clean debounce/branch, exact reversion, equal unknown text,
clean supersession/destruction and draft arriving before debounce execution.
Initialfullweb1519/148RC0 before last timer unit; finalweb1520/148actual,
API265/31cachedRC0. InitialwebbuildactualRC0. Firstfocused9PASS then aborted
because fixture chose nonexistent VERIFIED status. Fixture changed to actual
REVIEWED, no app fix. Second/restored12/0RC0. Oldapp0PASS then missingguidance
intentionaltimeout/suiteabort; currentrestored/full logretained. Actual dirty
edit, forceddisabled nativevalues, heldblursave, olderconfirmed/newerdraft,
normalpersistedconfirmation,503unknown/noreplay, cleanname/status/tag and clear
checked through browser/API/PostgreSQL. APIa/b/c/d,preview644,2FA37,SAML55allfirstRC0. Automations132/0firstactual
via12separatelypreparedunchangedsourcebundles/temporaryharnessskiponlyesbuild
artifactchecks/assertionssleepsDBunchanged/fresh55875cleaned. Separate
sync95+144239unique/native116+111+19246total242unique4startuprepeats each
firstinnerouter0/config16/14/docs4/reaper4all0. Two setup typos did not launch
intended checks: nonexistent npm sync-stage-config and wrong reaper filename.
Correct actualsync-browser-stage-config16/0andreaped-runner-test4/0; completed
visualconfig/docs preserved. All148isolatedbrowser suites firstRC0/1622assertions,
no sourcechanges during sweep. Completedchecks preserved across routine pauses,
staged rather than canonical uninterrupted claim. READMEPLANupdated; final
docs4/0RC0 and diffcheck clean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
