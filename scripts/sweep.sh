#!/bin/bash
# Full sweep with per-leg exit-code capture: a suite passes only if its
# command exits 0 AND prints no FAIL lines. No output is piped through
# tail/grep in a way that could mask a nonzero exit.
set -o pipefail
cd ~/Open-locale
FAIL=0
mkdir -p /tmp/sweep-legs
for s in integration authz statuses comments activity imports screenshots tasks tm glossary qa formats webhooks tags apitokens docs cli snapshots permissions review migration branches merge-concurrency ota reports incontext incontext-edit mt automations 2fa oidc groups; do
  npm run --silent "test:$s" > "/tmp/sweep-legs/$s.log" 2>&1; rc=$?
  fails=$(grep -cE "^FAIL" "/tmp/sweep-legs/$s.log")
  if [ "$rc" != "0" ] || [ "$fails" != "0" ]; then echo "SUITE-FAIL $s (rc=$rc fail-lines=$fails)"; FAIL=1; else echo "ok $s"; fi
done
npx nx test api --skip-nx-cache > /tmp/sweep-legs/unit-api.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok unit-api" || { echo "SUITE-FAIL unit-api (rc=$rc)"; FAIL=1; }
npx nx test web --skip-nx-cache > /tmp/sweep-legs/unit-web.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok unit-web" || { echo "SUITE-FAIL unit-web (rc=$rc)"; FAIL=1; }
npx nx build api --skip-nx-cache > /tmp/sweep-legs/build-api.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok build-api" || { echo "SUITE-FAIL build-api (rc=$rc)"; FAIL=1; }
npx nx build web --skip-nx-cache > /tmp/sweep-legs/build-web.log 2>&1; rc=$?; [ "$rc" = "0" ] && echo "ok build-web" || { echo "SUITE-FAIL build-web (rc=$rc)"; FAIL=1; }
echo "SWEEP-DONE fail=$FAIL"
