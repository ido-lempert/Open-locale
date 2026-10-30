# Review 0085 - Automations notify action in settings UI (slice 20)

## Why
Slice 19 added the notify action server-side, and its report wrongly claimed
"no rules UI exists". The settings page has had an Automations panel all
along (rule list, enable/disable, remove, admin create form); a
case-sensitive grep missed it. Left as-is, the panel would not offer notify
and would render an API-created notify rule as "task: undefined". The intro
copy also said rules "never call external services", stale the moment notify
existed. This slice corrects the UI and the record.

## What changed (web only)
- Action select gains "notify project webhooks"; selecting it shows a
  message input (maxlength 200, {key} templating).
- addRule builds { message } for notify; ruleSummary renders
  "notify webhooks: <message>" instead of falling through to the task
  branch.
- Intro copy now says rules fill test data, create tasks, or notify this
  project's registered webhooks, and that a rule itself cannot send anywhere
  else. The blanket "never call external services" claim is gone.

## Five passes
- Developer: three-way config mirrors the existing pattern; web build RC=0.
- PM: UI parity with the API surface for all three actions.
- Designer: same form shape as the other actions; screenshot
  editor-29c-automations-notify.png OCR-inspected at 2x: updated copy, both
  rules listed with correct summaries, notify option + message input
  visible.
- Security: the message input is maxlength-bounded like the server's 200;
  the copy states the egress boundary (admin-registered webhooks only).
- QA: +3 click-through legs in e2e-visual (notify option reveals the message
  input; rule created via the real form and listed with the exact summary;
  creating a key fires it - automation.run activity carries the interpolated
  message). e2e-visual 238 PASS / RC=0 (was 235).

## Boundaries
- Automations stays PARTIAL (external endpoint delivery is production
  acceptance). No coverage change.
