# Review 0021 - webhooks slice + binding/secret hardening + Android import honesty

Date: 2026-10-28. Scope: per-project webhooks (CRUD + HMAC-signed fire-and-forget
delivery on translation.updated), loopback-only dev API binding with non-local
binding gated on a real secret, Android import rejection of unsupported constructs,
and the related test repairs.

## Pass 1 - Developer
Findings:
1. `prisma migrate dev` against the hand-written migration history produced a noisy
   full-drift diff (drops/recreates of every FK with prisma-default names). Fixed by
   hand-writing the webhooks migration to match repo convention; drift content not
   committed.
2. A Python replace-all during development wired webhook delivery into setStatus as
   well as upsert; caught by the build (undefined names), removed: status-only changes
   do not emit translation.updated.
3. Integration suite count "5 vs 7" reconciled: the script prints 7 named PASS checks;
   the 5 was a grep-pattern artifact ("^ok" lines from child processes). No coverage lost.
Clean rerun: nx build api OK; api unit 21/21.

## Pass 2 - Product manager
Findings:
1. Mixed valid+unsupported Android imports previously reported partial success; now the
   whole import 400s and verification shows keys/history unchanged (no silent loss).
2. Webhook event catalog currently has one event (translation.updated); stated as
   v1 scope rather than implied parity with Lokalise's wider event list.
3. Secret is revealed exactly once (create response), matching the API-token UX.

## Pass 3 - Designer
No user-facing surface in this slice (webhook management UI is a follow-up); recorded
honestly rather than rubber-stamped.

## Pass 4 - Security researcher
Findings:
1. The non-local binding guard only checked JWT_SECRET presence; an operator could set
   it to the published fallback value. Fixed: the guard compares against the known
   fallback constant (now shared via dev-secret.ts); refusal verified live.
2. Verified binding behavior live: dev default answers only on loopback (non-loopback
   connection refused); HOST=0.0.0.0 without a real secret refuses; with a real secret
   it binds and answers on the box's non-loopback IP.
3. Webhook URLs are member-controlled (SSRF-shaped). Accepted scope for self-hosted
   webhooks: project members already hold full API access to the project, so loopback
   targeting grants no new privilege; http/https only enforced; 5s timeout; delivery
   errors never fail the triggering write; signature lets receivers verify authenticity.
4. DTD/entity declarations in Android XML are rejected as unsupported (counted, import
   400s). Claim is "no entity expansion, tested" - not a universal parser guarantee.

## Pass 5 - QA / integration
- New suite scripts/webhooks-test.mjs: 11 checks (one-time secret, list omits secret,
  unknown event 400, cross-team 404 list+delete, live delivery, event header, HMAC
  signature verification, payload contents, inactive hook silent, delete). All PASS.
- formats suite extended to 22 checks incl. mixed-import atomicity.
- Regression: statuses 14 PASS, authz 28 PASS, api unit 21/21, web build green.
- Full 13-suite sweep + e2e 40 PASS was run earlier this cycle after the binding fix.
