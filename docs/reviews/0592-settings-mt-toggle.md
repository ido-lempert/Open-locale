# Guard pseudo-provider enabled-state changes

## Developer review
Loaded id/enabled state plus busy guard refuse stale/missing/duplicate calls.
Accepted enabled boolean updates only target locally before providers-only refresh.
Refusal leaves state intact for explicit retry. No API/schema change or cross-client
concurrency guarantee.

## Product review
Receipt separates saved state from refresh failure. Selection and saved rules stay;
toggling does not run Fill empty, undo translations or repair saved rules. Work
already in progress may finish. Only offline pseudo test data, never real MT.

## Design review
Four1278x899/390x844 disabled/enabled pixels inspected: receipt and retained name
and provider selection readable, fit without horizontal overflow. Provider target
controls above receipt-focused mobile viewport; desktop shows both providers.

## Security review
Disposable local pseudo providers; saved disabled rule only. No automation fired,
Fill empty request, translations/tasks/deliveries created, external MT request,
worker enablement/spend/account/credentials/scope/license change. Existing server
admin checks unchanged. Exact provider metadata and saved rule bytes compared.

## QA review
Five initial units and firstbuildRC0 webactual/APIcached. Focus first0PASS fixture
setup400: unsupported key.created+pretranslate. Fixture-only trigger corrected to
translation.value, leaving disabled rule/no writes to translations; corrected11/0.
Discriminating stale-state-only negative1PASS2FAILRC1(assertion+abort); restored11/0.
Actual browser/API/PostgreSQL proves missing/stale/403/heldduplicate/other/delete
blocking, disable503 acceptedlocal+server/no stale replay, fresh explicit enable,
providers-only reads, exactmetadata/rule preservation and no effects/runtimeerrors.
Full regression: all218 independent browser suites current2498PASS/0FAIL,
215 FIRST0;060/078/088 first0PASS1FAIL startupPGbindaborts at55612/55706/55724.
060/078 loopbackTIME_WAIT06/noListener,4x3s/11x3s bind waits then available;
088 already no socket/bind available at inspection. Unchanged second4/10/12PASS
RC0, first logs preserved, no app/fixture source change.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 passed;
permissions first0PASSRC1PG55454bindabort/TIME_WAIT06, firstbindfailed,next3s
available, unchanged second50/0. Others FIRST0. Sync95+144=239 FIRST0;
native116+111+19=246 FIRST0 (four repeated startup checks). Config16/14/docs4/
glossary-reset3/runner4/syntax/diff0. Finalunits/buildbothcachedRC0/docs4/syntaxdiff0. Fourfinalpixelsinspected and
five review passes closed after this evidence. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
