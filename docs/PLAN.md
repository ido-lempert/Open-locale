# Open-locale implementation plan

Open-source replacement for Lokalise: Nx monorepo, Angular, PostgreSQL.
This plan maps the reference product's capabilities from its public product pages,
pricing matrix and API reference, and prioritizes them into four phases.
Checked 28 Oct 2026 against lokalise.com and developers.lokalise.com.

## What the product must cover

Lokalise is a full localization platform, not only a developer API. Its surface
breaks into five areas:

- **Translation management core**: projects with branching, keys, a collaborative
  web editor, translation memory, glossary, QA checks, screenshots for context,
  translation statuses and history, and import/export across 30+ formats.
- **Collaboration**: teams, roles and permissions, user groups, comments, tasks
  with locks and chaining, and audit logs.
- **Automation and delivery**: a full REST API with OAuth 2, CLI, SDKs, webhooks,
  60+ integrations (GitHub, Figma, Slack), over-the-air mobile updates, and
  in-context web and mobile editors.
- **AI and machine translation**: context-aware AI translation, multi-engine
  routing, quality scoring, and custom AI profiles.
- **Enterprise**: SSO/SAML, 2FA, secure password policies, reporting dashboards,
  and vendor rate profiles.

**Coverage gaps.** This map comes from public pages and the API reference, not
from using a paid account. Areas seen only at summary level: Vantage document
internals, AI routing and scoring specifics, vendor rate management, and the
mobile SDKs. Phases 2-3 will be refined against the API spec as they approach.

## Architecture

| Piece | Choice |
| --- | --- |
| Monorepo | Nx 24, npm workspaces |
| Web app | Angular (standalone, zoneless) |
| API | NestJS + Prisma, public REST API |
| Database | PostgreSQL 16 |
| Local run | docker-compose: db, api, web |
| CI verification | Real embedded PostgreSQL in tests |

The Docker configuration is statically verified (scripts/docker-static-test.mjs)
but not yet executed - the development sandbox has no Docker daemon. Until a real
`docker compose up` on a machine with Docker, database-backed checks run against
a real PostgreSQL started by the test harness.
The repository stays unlicensed for now: MIT is the recommendation.

## Phase 0 - foundation

The smallest product that is genuinely usable: sign in, create a project,
add languages, manage keys and translations, export a file.

- Repo scaffold: Nx monorepo with apps/web (Angular), apps/api (NestJS), shared types library.
- Database schema: users, teams, projects, locales, keys, translations. Prisma migrations on PostgreSQL.
- Auth: email + password sign-in with JWT, plus personal API tokens.
- Projects, languages, keys: full CRUD with per-project language lists and plural-aware key metadata.
- Translation editor v1: filterable key list with side-by-side language editing and autosave.
- Import/export v1: JSON (nested and flat) upload and download per language.
- docker-compose: one command runs Postgres, API and web on any machine with Docker.

## Phase 1 - a working TMS

- Statuses and history: unverified/reviewed states per translation with full version history.
- Tags, search, filters: key tags, text search, and filters by status, language and tag.
- Comments: per-key threads with mentions, scoped to a language or all languages.
- Screenshots: upload context screenshots and link them to keys.
- Tasks: create translation or review tasks, assign contributors, set due dates.
- Translation memory: exact and fuzzy match suggestions while typing; TMX export.
- Glossary: project terms with forbidden variants, surfaced in the editor.
- QA checks: placeholder mismatch, length limits, whitespace, number and HTML checks.
- Activity log: every change recorded per project, filterable by actor and target.
- More formats: PO/POT, XLIFF, Android XML, iOS strings/stringsdict, CSV, ARB, RESX.

## Phase 2 - automation and scale

- Review workflow: custom translation statuses and review queues per language.
- Public REST API v1: everything the UI does, with OpenAPI docs and scoped tokens.
- Webhooks: project events pushed to any URL with signed payloads.
- CLI: upload and download translation files from the terminal.
- Branching and snapshots: project branches with merge, plus restorable auto snapshots.
- Granular permissions: per-language contributor access, groups, admin roles.
- GitHub integration: two-way sync between a repo and a project.
  Current bounded slice: target screen previews accepted baseline, stored local
  translations and fresh verified remote bytes, with manual-review rows and
  pagination. Explicit draft selections/download recompute sources and check
  reviewed fingerprint before preparing bytes. No apply or two-way synchronization
  yet. Draft API materializes locale-only set/removal plans without executing
  them. UI reviews materialized set/removal/current/draft values with independent
  pages. Same-snapshot key/row/metadata preconditions prepared for future guarded
  execution, plus internal Serializable locked-row validation. No apply path
  yet. Isolated existing-key locale-set writer with history/activity rollback
  tests; durable locale-removal audit added, production integration still open.
  Internal current-admin/target/baseline locked transaction guard added; no public
  execution. Isolated exact-draft transaction composition added, missing production
  effects/fresh-source execution integration remain. Transactional TM helper shared
  with normal save/import and isolated writer. Durable transaction-coupled effect
  intents added; dispatcher/retry/retention still code work. See reviews0134-0146.

## Phase 3 - advanced

- OTA delivery: over-the-air translation updates with a versioned CDN endpoint and mobile SDK.
- In-context editor: edit translations live on your own website.
- AI and MT hooks: pluggable machine-translation providers and AI pre-translation with scoring.
- Reporting: quality, usage and task dashboards per project.
- SSO/SAML and 2FA: enterprise sign-in and second factors.
- Automations: trigger-based rules - on key change, pre-translate, create task, notify.

## How every development lands

1. Developer pass: correctness, simplicity, error handling, no dead code.
2. Product-manager pass: does it match the capability map and the user's flow.
3. Designer pass: layout, hierarchy, empty and loading states, mobile widths.
4. Security-researcher pass: injection, auth bypass, data exposure, dependency risk.
5. QA/integration pass: real database run, API and UI wired end to end.
6. All findings fixed and the passes re-run clean; only then a commit.

## Sources

- https://developers.lokalise.com/reference/lokalise-rest-api - endpoint families including branches, OTA and OAuth 2.
- https://lokalise.com/product - platform positioning and feature areas.
- https://lokalise.com/pricing - the full feature matrix used for the capability map.
- https://lokalise.com/integrations - the 60+ app directory.
- https://github.com/ido-lempert/Open-locale - where all code lands.
