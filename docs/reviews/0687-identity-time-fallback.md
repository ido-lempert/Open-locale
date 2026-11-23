# Guard linked identity timestamps

## Developer
Bounded formatter replaces unguarded DatePipe. Non-string/blank values and formatting failures return Link time unavailable. Valid values still use medium format with injected LOCALE_ID and existing timezone behavior. Identity objects and unlink handlers are untouched.

## Product
Malformed link-time metadata must not hide linked identities or imply no identities. No invented time, provider verification, unlink or account repair. Explicit refresh recovers valid display and still clears unlink choices as before.

## Designer
Inspected actual1280px and390px screenshots. Fixed unavailable label wraps within existing cards, alongside issuer and explicitly unverified provider-email metadata. No horizontal overflow or raw malformed time.

## Security
No new endpoint, permission, storage or external destination. Fixed label cannot execute markup. Opening unlink still requires a separate password/confirmation; malformed display never sends deletion. Local fixture identities only, no real provider registration or account change.

## QA and integration
- Focused identity units18/0, including ten added invalid/non-string/blank and exact valid locale formatter cases.
- Nonoverlapping staged web units136files/1722tests plus136files/1568tests =272unique files/3290tests passed. Staged, not uninterrupted.
- New real browser/API/PostgreSQL response-interception suite6/0: malformed/empty time with valid neighboring identity, no raw payload or writes,390px layout, explicit unlink opening without deletion, explicit read recovery with choice reset and all three fixture identities still present. New harness has explicit completion/failure guard.
- Blank-fallback negative probe failed exactly intended assertion,5pass/1fail; restored6/0.
- Other affected identity browsers: refresh7, identities-guards7, link-guards5, link-configuration11. Total36 browser assertions passed. Existing API exercised through real local fixtures; standalone full SAML/2FA suites not rerun for this display-only change.
- API/web builds, docs consistency138routes, script syntax and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
