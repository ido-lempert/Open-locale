#!/bin/bash
# Full sweep with per-leg exit-code capture: a suite passes only if its
# command exits 0, prints no FAIL lines AND ran at least one PASS check. No output is piped through
# tail/grep in a way that could mask a nonzero exit. The wrapper itself exits
# nonzero when any leg fails (fail-closed): SWEEP-DONE fail=N and the process
# exit code always agree.
set -o pipefail
cd ~/Open-locale
FAIL=0
# Preflight: two suites sharing a PG port poison each other whenever one dies
# mid-run and leaves its postmaster behind. Fail loudly instead.
dups=$(grep -h '^const PG_PORT = [0-9]' scripts/*-test.mjs scripts/e2e-visual.mjs | grep -o '[0-9]\{5\}' | sort | uniq -d)
if [ -n "$dups" ]; then echo "SUITE-FAIL preflight (duplicate PG ports: $(echo $dups | tr '\n' ' '))"; FAIL=1; fi
mkdir -p /tmp/sweep-legs
for s in integration authz statuses comments activity imports screenshots tasks tm glossary qa formats webhooks tags apitokens docs cli sdk snapshots permissions review migration branches merge-concurrency ota reports incontext incontext-edit mt automations 2fa oidc saml oidc-browser saml-browser groups plural docker; do
  npm run --silent "test:$s" > "/tmp/sweep-legs/$s.log" 2>&1; rc=$?
  fails=$(grep -cE "^FAIL" "/tmp/sweep-legs/$s.log")
  passes=$(grep -cE "^PASS" "/tmp/sweep-legs/$s.log")
  # Zero executed checks is a failure even when rc=0: a runner can exit
  # silently mid-await (empty event loop) and must never count as green.
  if [ "$rc" != "0" ] || [ "$fails" != "0" ] || [ "$passes" = "0" ]; then echo "SUITE-FAIL $s (rc=$rc fail-lines=$fails pass-lines=$passes)"; FAIL=1; else echo "ok $s"; fi
done
npx nx test api --skip-nx-cache > /tmp/sweep-legs/unit-api.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok unit-api" || { echo "SUITE-FAIL unit-api (rc=$rc)"; FAIL=1; }
npx nx test web --skip-nx-cache > /tmp/sweep-legs/unit-web.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok unit-web" || { echo "SUITE-FAIL unit-web (rc=$rc)"; FAIL=1; }
npx nx build api --skip-nx-cache > /tmp/sweep-legs/build-api.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok build-api" || { echo "SUITE-FAIL build-api (rc=$rc)"; FAIL=1; }
npx nx build web --skip-nx-cache > /tmp/sweep-legs/build-web.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok build-web" || { echo "SUITE-FAIL build-web (rc=$rc)"; FAIL=1; }
echo "SWEEP-DONE fail=$FAIL"
exit "$FAIL"
