# 0034 - Machine-translation hooks (provider contract + pseudo driver + pre-translate)

First slice of the Phase 3 "AI and MT hooks" capability: a pluggable
provider registry, one built-in offline driver, and a fill-empty-only
pre-translate run. No external MT engine is implemented: real engines need
credentials, network reach and explicit user authority. The provider
contract (name/type/config/enabled per project) is where they plug in.

## What shipped
- `MtProvider` model (migration 20261029014000_mt_providers): per project,
  unique name, driver `type`, JSON `config`, `enabled` flag.
- Driver registry (`apps/api/src/app/mt/mt.providers.ts`): the extension
  point. Ships with `pseudo` - deterministic pseudo-localization (accented
  ASCII, bracket-wrapped, ~20% padding, target-locale tag) that preserves
  ICU/printf placeholders and HTML tags. Useful on its own for spotting
  hard-coded strings and layout breakage.
- API (`/projects/:id/mt/...`): provider CRUD (admin-only; duplicate name
  409, unknown type 400) and `POST /pretranslate {providerId, locale,
  sourceLocale?, branch?, keyIds?}`. Runs are branch-scoped: `branch`
  defaults to 'main' explicitly (never "wherever the key lives"), an unknown
  branch is 400, and same-named keys on other branches are invisible to the
  run. keyIds from another project select nothing.
- Pre-translate semantics: fills EMPTY target cells only, from the source
  locale (default base). Never overwrites a non-empty value - the write is
  conditional in the statement itself (INSERT .. ON CONFLICT DO UPDATE ..
  WHERE value=''), so a value landing between read and write is kept. New
  and filled rows start UNVERIFIED, version 1 / version+1, with history rows
  attributed to the acting user and one `mt.pretranslate` activity event.
  Batch cap 200 keys per run (400 above; narrow with keyIds).
  `keyIds: []` selects nothing, not everything. Locale-restricted members
  can only run it on their locales; target == source is 400.
- Settings UI: provider list with enable/disable and remove, add-provider
  form (pseudo type), and a pre-translate runner (provider + target locale)
  reporting filled/already-translated/no-source counts.

## Verified
scripts/mt-test.mjs - 35 checks, real PG + HTTP:
- admin-only provider management (member 403), type whitelist, 409 on
  duplicate name, cross-project provider id 404, delete -> 404 on use.
- Fill-empty-only: run fills 2 empty rows, skips 1 existing (value AND
  version AND history count untouched) and 1 empty-source key; second run
  translates 0.
- Output: bracket/locale-tag wrapping, accenting, `{name}`, `<b>`, `%s`
  preserved; deterministic modulo the locale tag across locales.
- Permissions: locale-restricted member 403 on he, allowed on fr.
- Cap: 201 keys 400; scoped run via keyIds works.
- Activity log records the runs with provider, locale and counts.
- Branch isolation: default main run leaves a same-named feat-branch key
  untouched; explicit branch run fills only that branch; unknown branch 400;
  foreign-project keyIds select nothing.
- Identity: MT-filled rows expose a rowId; a human overwrite (version 2)
  keeps the same rowId; a following run leaves value/version/rowId and the
  2-row history (MT fill, human edit) untouched.
- Semantics: whitespace-only values count as human content (skipped, never
  filled over); a REVIEWED row keeps value, status and version.
- Copy: the panel and result line state the output is pseudo-localization
  TEST DATA, not real translation, and that external engines are not
  available in this slice; the UI runner passes the branch explicitly.
scripts/e2e-visual.mjs: provider added and run through the settings UI in
real Chrome; result line shows 2 filled / 3 untouched / 1 without source
(editor-28-mt.png, pixel-inspected).

## Scope limits
- The pseudo driver is the only driver; "external engines plug into the
  same contract" is a design statement, not a tested integration.
- Pre-translate runs synchronously within the request; the 200-key cap keeps
  it bounded. No queue/retry layer yet.
- MT output marks rows UNVERIFIED but does not run QA checks on them yet
  (automations can chain that later).
