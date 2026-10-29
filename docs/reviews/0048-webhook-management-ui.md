# 0048 — Webhook management UI

0020 hardened webhook delivery (egress validation, pinned transport,
redirect refusal) but left management API-only; the settings page only
mentioned webhooks in prose. This slice closes the management loop in
the project settings UI.

## What changed

- New Webhooks panel in project settings: explanatory copy (signed
  POSTs, X-OpenLocale-Event / X-OpenLocale-Signature HMAC-SHA256,
  private/internal addresses refused), the webhook list (URL, events,
  created date, disabled badge), and admin-only controls.
- Create form (admin): URL + event checkboxes (translation.updated,
  project.restored; at least one required, checked client-side before
  the API call). The one-time signing-secret reveal mirrors the API
  token pattern (notice + copy button).
- Row actions (admin): disable/enable toggle (PATCH active) and delete
  with the same inline-confirm pattern as token revocation.
- Read-only for non-admins: the list endpoint only requires project
  membership, so members see the rows without the controls - same
  convention as the Members and Groups panels.
- No API change: the existing list/create/update/delete endpoints and
  the one-time-secret-on-create contract are reused as-is.

## Verification (e2e-visual, real browser against the real API)

- Create via UI: type URL, check project.restored, submit - one-time
  secret reveal appears; the row lists the URL and both events.
- Failed create: a denied address (http://192.168.1.1/hook) is refused
  with the reason visible in the page's error slot, the typed URL stays
  in the input for correction, and no row appears. Scope note: this
  verifies the UI surfacing of the existing create-time string
  validation. The delivery-time egress rules (DNS pinning, redirect
  refusal) are an existing API claim covered by the API-level webhook
  suites; this web-only slice did not re-prove delivery.
- The reveal is component state: after a fresh page load it is gone and
  the list carries only the public view (no secret) - asserted, and the
  screenshots are taken only in that state (never captures a secret,
  matching the token-shot convention).
- Disable shows the disabled badge; re-enable clears it.
- 480px layout: a long unbroken URL wraps (overflow-wrap rule on the
  hook URL span) and document.scrollWidth stays within the viewport;
  editor-34b-webhooks-narrow.png pixel-inspected.
- Member read-only view: a MEMBER-role account sees the rows but no
  Disable/Enable/Delete buttons and no create form (UI gating;
  mutations stay server-enforced by requireAdmin).
- Delete asks inline confirmation; after confirming, the row disappears
  and an independent API fetch agrees every test webhook is gone.
- editor-34-webhooks.png (1280) pixel-inspected: heading fully visible,
  copy and rows readable, no truncation, no secret in frame.

## Review pass notes

- Developer: reuses api.service request wrapper and the token panel's
  reveal/confirm patterns; list refresh goes through the existing
  reload() so no stale state lingers after mutations.
- PM: matches the token management loop users already know; the two
  event names are the API's exact identifiers, not paraphrases.
- Designer: disabled is a badge, not a style change on the URL, so the
  state reads the same in the row and in screenshots.
- Security: the secret is never listed, never persisted in the
  component beyond the reveal, never screenshot; admin-only mutations
  stay server-enforced (requireAdmin), the UI gating is cosmetic.
- QA/integration: e2e-visual +15 checks (create/reveal, listed, failed
  create reason/retention/no-row, reveal cleared on reload, disable
  badge, enable clears, long-URL fixture, 480 no-overflow, member
  list/no-controls/no-form, delete confirm, API agrees) = 146. No
  API-surface change, so the tasks/webhook API suites run unchanged.
