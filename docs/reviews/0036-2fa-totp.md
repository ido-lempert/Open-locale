# 0036 - Two-factor authentication (TOTP)

Account-level second factor for password login. Test-accounts-only slice:
no real user enrollment, no external IdP, no account-provider changes.
SSO is not in this slice.

## What shipped
- User model: `totpSecret` (AES-256-GCM encrypted at rest,
  `enc:v1:<iv>:<tag>:<ct>`, key from TOTP_ENCRYPTION_KEY with a clearly
  marked dev fallback), `totpEnabled`, `totpLastCounter` (replay
  protection), `totpFailedAttempts` + `totpLockedUntil` (lockout), and a
  `RecoveryCode` table (sha256 hashes only). Migration
  20261029024000_user_totp.
- TOTP (RFC 6238, SHA1/30s/6 digits, +-1 step window) implemented over
  node:crypto - no new dependency. Secrets are 160-bit, base32 for
  authenticator entry; otpauth:// URL returned at setup.
- Flow: setup stores an ENCRYPTED pending secret but does not enable;
  enable requires a valid code (proves the authenticator was configured)
  and returns 8 one-use recovery codes exactly once; disable requires a
  valid TOTP or recovery code and wipes secret + recovery codes.
- Login: after password verification, accounts with 2FA must supply a
  TOTP code or recovery code. Replay protection: a code at or below the
  last-seen counter is rejected (the enable code itself cannot be reused
  to log in). Recovery codes are consumed atomically
  (UPDATE .. WHERE usedAt IS NULL) so a code cannot be raced twice.
- Lockout: 5 consecutive bad second-factor attempts lock 2FA for 10
  minutes; the lock is checked before verification, so even a correct
  code is refused while locked. The counter resets on success. Password
  is verified first, so the lock cannot be triggered without the
  password and reveals nothing about which accounts have 2FA.
- Session-only management: setup/enable/disable/status require a browser
  session JWT; API tokens get 403 - a leaked token cannot change or
  enumerate the second factor.
- UI: security panel on the projects page (setup shows secret + otpauth
  URL once, enable shows recovery codes once with a store-them-now
  warning, status shows remaining recovery codes, disable form). Login
  form gains an optional 2FA code field (only needed when enabled).

## Hardening pass (post-review)
- Production fail-closed: with NODE_ENV=production and no
  TOTP_ENCRYPTION_KEY (or one under 16 chars), secret encryption throws -
  setup fails closed rather than ever using the dev fallback outside
  local development.
- Step-up: JWTs carry an `mfa` claim, true only when the login completed
  the account's second factor. Once an account enables 2FA, sessions
  without the claim get 403 on API-token mint/list/revoke and 2FA
  status/disable - checked live against the DB, so enabling takes effect
  on the very next request. Setup/enable/disable additionally require
  the current password (fresh-password step-up inside the session).
  Because the enabling session loses status reads immediately, the UI
  takes the enabled state from the enable response.
- Concurrency: the last-seen counter claim is a single conditional
  UPDATE (totpLastCounter < matched) - exactly one simultaneous
  identical-code submission wins. Failure counting uses an atomic
  increment - concurrent failures cannot lose counts. Recovery-code
  consumption was already atomic (single winner under simultaneous use).
- Recovery codes: 16 Crockford chars (~80 bits), shaped XXXXXXXX-XXXXXXXX.
- Documented boundary: an API token created before enabling 2FA keeps
  serving its scoped calls (bearer tokens are a separate credential and
  do not pass 2FA) but gets 403 on every session-only route.

## Verified
scripts/2fa-test.mjs - 28 checks, real PG + HTTP, independent TOTP
implementation (test does not reuse the code under test):
- enable-before-setup 401; setup returns secret + otpauth URL without
  enabling (login still single-factor).
- Storage read directly through Prisma: totpSecret starts enc:v1: and
  does not contain the plaintext secret; recovery code rows hold only
  64-hex hashes.
- wrong code cannot enable; valid code enables; 8 codes shaped
  XXXXX-XXXXX returned once.
- login without code 401 "two-factor"; wrong code 401; valid code 200;
  same code replayed within its window 401.
- recovery code logs in once, reuse 401; status shows 7 remaining.
- API token: setup and status both 403.
- 5 bad codes lock; correct code during lock 401 "try again later".
- disable with valid code works; login single-factor again; old secret
  and recovery codes wiped (reuse 401, count 0).
- step-up: setup without/with-wrong password 401; pre-2FA session JWT
  gets 403 on token mint/list + 2FA status/disable after enable;
  disable with wrong password 401.
- simultaneous identical TOTP logins: exactly one 200; simultaneous
  same-recovery-code logins: exactly one 200; 5 parallel bad codes lock.
- pre-2FA API token still serves scoped GET calls (200) while 2FA routes
  403 - the documented bearer-token boundary.
- production mode without TOTP_ENCRYPTION_KEY: setup 500 (fail closed).

e2e-visual additions (scripts/e2e-visual.mjs, 72 checks green):
- setup via projects-page panel shows the secret; enable via UI lists 8
  recovery codes; log out + log in with a TOTP code through the login
  form succeeds. Screenshot editor-30-2fa.png masks the secret and code
  interiors (throwaway demo account, but credentials never appear in
  captures).

## Explicit limits / not in this slice
- No challenge-response split: password + code travel in one POST, so
  there is no server-side challenge state to expire. The TOTP window
  (+/-1 step) is the code expiry.
- A TOTP code is valid for its whole 30s window (industry standard);
  replay WITHIN the window is blocked by the last-seen counter.
- API tokens are a separate credential with scopes, not affected by 2FA
  (they can only be minted from a 2FA-completed session).
- No password-reset flow exists; when one ships it must require 2FA or
  invalidate sessions - recorded here as a requirement.
- No SSO/OIDC yet.
- Lockout state is per account in the DB (survives restarts), but there
  is no global/IP rate limiting yet.

## Second hardening pass (epoch revocation + startup fail-closed)

1. Startup fail-closed key enforcement: the API refuses to boot when (a) NODE_ENV=production without a strong explicit TOTP_ENCRYPTION_KEY (>=16 chars), (b) any non-loopback bind without one, or (c) the variable holds the known built-in development value - in every environment. Verified by spawning the compiled API under all three conditions: the process exits non-zero and never listens (replaces the earlier setup-time 500 behavior).
2. Session epoch revocation: users.authEpoch, carried as a JWT epoch claim. Enabling or disabling 2FA increments the epoch, revoking every earlier JWT - a pre-2FA 7-day session dies on the very next request after enable (tested 401 on token mint/list, 2FA status/disable/setup AND ordinary data routes). Every JWT-authenticated request re-checks epoch + live totpEnabled against the database. API bearer tokens deliberately skip epoch/2FA: scoped credentials outside the session model, verified still serving read-scoped GET while blocked from all session-only routes.
3. Generation binding: because disable also bumps the epoch, an MFA-completed JWT from a previous 2FA generation can never become valid again after re-enable with a new secret. Lifecycle test: stale MFA JWT gets 401 after re-enable; the old secret's codes are rejected; the new secret's codes are accepted.
4. Pending-setup overwrite guard: POST /auth/2fa/setup returns 409 while 2FA is enabled, so a replayed/duplicated setup cannot rotate the live secret (a fresh setup is only possible after an authenticated disable). Tested.
5. Honest client re-auth: enable/disable revoke the current session too, so the web app no longer keeps the user visually signed in on a dead token. Enable shows the one-time recovery codes, then "I've stored these - sign in again" routes to the login page with a re-auth notice; disable signs out immediately with a notice. The clean enabled-state screenshot is captured on the fresh, epoch-valid session after re-login. Verified in e2e (notice shown, re-login with TOTP code succeeds, clean state rendered).
6. Recovery codes remain test-account fixtures only; no real accounts exist.

Suite: scripts/2fa-test.mjs 37 checks 0 FAIL; e2e-visual 75 PASS 0 FAIL.
