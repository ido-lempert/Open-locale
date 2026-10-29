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

## Verified
scripts/2fa-test.mjs - 20 checks, real PG + HTTP, independent TOTP
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
