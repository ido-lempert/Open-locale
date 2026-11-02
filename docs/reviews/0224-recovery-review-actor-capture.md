# 0224 - Capture the original recovery-review actor

## Developer pass
Capture the authenticated actor ID before the first authorization await. Reuse the
primitive for preflight, snapshot authorization, direct-team membership and both
returned review bindings. No later reads of the caller-owned principal inside
this review. Execution already captures its actor before yielding.

## Product pass
This keeps a read-only review attributed to the session actor that started it.
No new route, restore action, worker enablement, remote write or baseline advance.
Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING, worker default OFF.

## Designer pass
No UI change. Inspected current 480x900 fixture screenshot: focused result,
target/path/UTC snapshot and no-reservation/no-restore notice wrap readably;
escaped archived value and controls visible, no horizontal overflow. First card
heading partly behind sticky header; second card extends below viewport.

## Security pass
Actual PostgreSQL review tests mutate the caller principal after preflight and
after in-snapshot authorization. Both replacement and original identities are
valid admins, so role denial cannot mask an actor-binding regression. Both review
bindings and authorization calls must retain the original actor. Actual recovery
value/effect counts stay unchanged. Restoring old source yields exactly the two
actor failures: 581 pass / 2 expected fail, RC1. Restored fixed source yields
583 pass, RC0. This is an internal mutable-input boundary test, not a claim of an
HTTP impersonation exploit or an execution grant.

## QA/integration pass
Sync 580 -> 583 (+2 actor cases, +1 unchanged-effects assertion), initial/final
RC0. Latest post-cleanup source sync583/browser156, individual/outer RC0.
All 43 unique integration/config legs verified in completed green batches.
API248/30 and web77/7, both builds and reaper4 RC0. Migration22,
automation132, webhook45, 137 routes. Native staged visual116+128=244 total /
242 unique, every literal check label present, inner/outer RC0; checkpoint removed.
Staged, not uninterrupted. No production/external acceptance claim.

Two oversized combined verification calls hit the 120s cap. First completed
automation but interrupted the next batch; second completed the 2FA retry batch
but interrupted the following SAML-browser batch. Stale sockets with verified
defunct owners caused a zero-check 2FA startup failure and a SAML-browser
suite-aborted failure. Used the supported alternate 2FA port and removed only
verified stale sockets; reran affected batches to completed green results.
SAML startup's erroneous inner RC0 was caught by the batch's FAIL/zero-check gate.
No unrelated application failures. No app changes after final integration runs;
only documentation followed.
