# 0035 - Automations (bounded trigger/action rules)

Project-scoped automation rules: when a whitelisted trigger fires, run a
whitelisted internal action. Deliberately narrow - triggers are only
`key.created` and `translation.value`, actions are only `pretranslate`
(pseudo TEST DATA, same engine as 0034) and `task.create`. No external
calls, no webhooks, no arbitrary expressions. This is the private
implementation slice; nothing here reaches outside the project.

## What shipped
- `AutomationRule` model (migration 20261029020500_automation_rules):
  per project, name, `trigger`, `action`, JSON `config`, `enabled`, creator.
- API (`/projects/:id/automations`): rule CRUD, admin-only (member 403).
  Unknown trigger/action 400, config validated per action.
- Trigger bounds (enforced in the hook call sites, not just the docs):
  - `key.created` fires only on the main branch.
  - `translation.value` fires only on base-locale writes on main; writes to
    non-base locales and other branches never fire it.
  - `key.created` + `pretranslate` is rejected (400): a new key has no
    source text yet, so the combo can only produce empty noise.
- Action bounds:
  - `pretranslate` fills EMPTY cells only, same conditional write as the
    manual runner; locale cap 5 per rule; bypasses the upsert hook so a
    rule can never retrigger itself (no recursion).
  - `task.create` creates a task titled from a template (`{key}` expands
    to the key name); nothing else.
- Runs execute as the rule's creator with a LIVE permission re-check at
  fire time: if the creator lost project access, the run fails visibly as
  an `automation.run` activity event with the error, and the triggering
  edit is unaffected (hooks are fire-and-forget after the write commits).
- Settings UI: Automations panel - rule list with enable/disable/remove,
  add form (trigger/action selects, provider + locale checkboxes for
  pretranslate, title template for task.create). Panel copy states the
  whitelist and the runs-as-creator rule explicitly.

## Verified
scripts/automations-test.mjs - 18 checks, real PG + HTTP:
- member create rejected (403); unknown trigger/action 400;
  key.created+pretranslate 400; foreign provider id 400; base locale in
  config.locales 400.
- base-locale write on main fires the rule: he cell filled with UNVERIFIED
  pseudo data; automation.run activity recorded with attribution.
- non-base and non-main writes do not fire; feat-branch key not auto-filled.
- automation writes do not re-trigger rules (no recursion), proven by the
  run count staying at 1 after the fill.
- key.created fires task.create with templated title ("Translate new key
  auto.two"); disabled rule does not fire; deleted rule does not fire.
- creator removed from the project: the triggering write still commits
  (200), the run is recorded with an error, and nothing is filled.
Fill-empty-only semantics of the pretranslate action itself (existing
values untouched, conditional write, history/version) are those of the
0034 runner and are verified in scripts/mt-test.mjs.

e2e-visual additions (scripts/e2e-visual.mjs, 68 checks green):
- rule created through the settings UI is listed; creating key auto.fired
  via the API fires the rule and the task "Translate new key auto.fired"
  appears.
- screenshots editor-28-mt.png (reframed, panel heading visible) and
  editor-29-automations.png.

## Explicitly NOT in this slice
- No external effects: no HTTP webhooks, no email, no MT engine calls.
- No automatic mutations beyond the whitelisted internal actions.
- No scheduling/triggering beyond the two write hooks.
