// Hand-maintained OpenAPI 3.0 spec for the public REST API v1.
// Every route below mirrors a real controller route; docs checks assert the
// count stays in sync with the implemented surface.
const json = { schema: { type: 'object', additionalProperties: true } };
const p = (summary: string, tag: string, body = false) => ({
  summary,
  tags: [tag],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  ...(body ? { requestBody: { required: true, content: { 'application/json': json } } } : {}),
  responses: {
    '2XX': { description: 'Success', content: { 'application/json': json } },
    '401': { description: 'Missing or invalid credentials' },
    '403': { description: 'Authenticated but not permitted (scope or role)' },
  },
});
const pub = (summary: string, tag: string, body = false) => {
  const d = p(summary, tag, body) as Record<string, unknown>;
  delete d.security;
  return d;
};

export const OPENAPI = {
  openapi: '3.0.3',
  info: {
    title: 'Open-locale API',
    version: '1.0.0',
    description:
      'REST API v1. Authenticate with a session JWT (`Authorization: Bearer ...`) ' +
      'or a scoped API token (`X-Api-Key: ol_...`). API tokens carry read and/or write ' +
      'scopes; read-only tokens are limited to GET/HEAD. Token management endpoints ' +
      'require a session JWT.',
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
    },
  },
  paths: {
    '/api/openapi.json': { get: pub('This OpenAPI document', 'meta') },
    '/api/auth/signup': { post: pub('Create an account', 'auth', true) },
    '/api/auth/login': { post: pub('Log in and receive a session JWT', 'auth', true) },
    '/api/auth/2fa/setup': { post: p('Generate a pending TOTP secret (session only; not enabled until verified)', 'auth') },
    '/api/auth/oidc/start': { get: pub('Begin SSO login (authorization-code + PKCE); returns the issuer authorization URL', 'auth', true) },
    '/api/auth/oidc/start-link': { post: p('Begin SSO identity linking for the signed-in account (session only, fresh password required)', 'auth', true) },
    '/api/auth/oidc/callback': { post: pub('Exchange authorization code + state; may return requiresTwoFactor', 'auth', true) },
    '/api/auth/oidc/complete': { post: pub('Finish an SSO login with the account TOTP code', 'auth', true) },
    '/api/auth/2fa/enable': { post: p('Verify a TOTP code and enable 2FA; returns one-use recovery codes once (session only)', 'auth') },
    '/api/auth/2fa/disable': { post: p('Disable 2FA with a valid TOTP or recovery code (session only)', 'auth') },
    '/api/auth/2fa/status': { get: p('Two-factor status and remaining recovery codes (session only)', 'auth') },
    '/api/auth/tokens': {
      post: p('Create a scoped API token (session only; raw token returned once)', 'auth', true),
      get: p('List API token metadata (session only; never includes raw tokens)', 'auth'),
    },
    '/api/auth/tokens/{id}': { delete: p('Revoke an API token (session only)', 'auth') },
    '/api/projects': {
      get: p('List projects for the current user', 'projects'),
      post: p('Create a project', 'projects', true),
    },
    '/api/projects/{id}': {
      get: p('Get a project', 'projects'),
      patch: p('Update a project', 'projects', true),
      delete: p('Delete a project', 'projects'),
    },
    '/api/projects/{id}/members': {
      get: p('List project members with roles and locale access', 'projects'),
      post: p('Add a member by email with role and locale restriction (admin)', 'projects', true),
    },
    '/api/projects/{id}/members/{userId}': {
      patch: p('Change a member role or locale access (admin; owner immutable)', 'projects', true),
      delete: p('Remove a member (admin; owner cannot be removed)', 'projects'),
    },
    '/api/projects/{id}/groups': {
      get: p('List team groups with their members', 'projects'),
      post: p('Create a group granting a role and locale access (admin; cannot grant at or above own role)', 'projects', true),
    },
    '/api/projects/{id}/groups/{groupId}': {
      patch: p('Update a group name, role or locale access (admin above the group role; applies immediately)', 'projects', true),
      delete: p('Delete a group (admin above the group role)', 'projects'),
    },
    '/api/projects/{id}/groups/{groupId}/members/{userId}': {
      put: p('Add a team member to a group (admin above the group role)', 'projects', true),
      delete: p('Remove a user from a group; access loss applies immediately (admin above the group role)', 'projects'),
    },
    '/api/projects/{id}/locales': { post: p('Add a target locale', 'projects', true) },
    '/api/projects/{id}/locales/{code}': { delete: p('Remove a target locale', 'projects') },
    '/api/projects/{projectId}/branches': {
      get: p('List branches with key counts (session only)', 'branches'),
      post: p('Create an empty branch (admin, session only; branches do not copy another branch)', 'branches', true),
    },
    '/api/projects/{projectId}/branches/{branchId}': {
      delete: p('Delete a branch and its keys (admin; main cannot be deleted)', 'branches'),
    },
    '/api/projects/{projectId}/branches/{branchId}/merge/preview': {
      post: p('Preview a merge: diff counts including overwrites, plus previewAt for the optimistic guard (admin)', 'branches', true),
    },
    '/api/projects/{projectId}/branches/{branchId}/merge': {
      post: p('Merge a branch into another: pre-merge snapshot, copy keys and translations with history attribution, target-only keys kept, post-preview edits skipped (admin)', 'branches', true),
    },
    '/api/projects/{projectId}/automations': {
      get: p('List automation rules (explicit trigger/action whitelist, internal effects only)', 'automations'),
      post: p('Create an automation rule (admin). Triggers: key.created, translation.value (base locale, main branch). Actions: pretranslate, task.create', 'automations', true),
    },
    '/api/projects/{projectId}/automations/{ruleId}': {
      patch: p('Update a rule (admin): rename, enable/disable, config', 'automations', true),
      delete: p('Delete a rule (admin)', 'automations', true),
    },
    '/api/projects/{projectId}/mt/providers': {
      get: p('List machine-translation providers for the project', 'mt'),
      post: p('Create an MT provider (admin; built-in type: pseudo)', 'mt', true),
    },
    '/api/projects/{projectId}/mt/providers/{providerId}': {
      patch: p('Update an MT provider (admin): rename, enable/disable, config', 'mt', true),
      delete: p('Delete an MT provider (admin)', 'mt', true),
    },
    '/api/projects/{projectId}/mt/pretranslate': {
      post: p('Fill EMPTY target cells with pseudo-localization TEST DATA (not real translation; branch-scoped, fill-empty-only, max 200 keys, rows start UNVERIFIED)', 'mt', true),
    },
    '/api/projects/{projectId}/ota': {
      get: p('List OTA publications (version, branch, locales, counts)', 'ota'),
    },
    '/api/projects/{projectId}/ota/publish': {
      post: p('Publish an immutable OTA bundle for a branch (admin, session only)', 'ota', true),
    },
    '/api/projects/{projectId}/ota/latest': {
      get: p('Pull the latest OTA bundle for a locale/branch (ETag, 304 on If-None-Match; authenticated, never public)', 'ota'),
    },
    '/api/projects/{projectId}/ota/{version}/{locale}': {
      get: p('Pull a specific OTA bundle version for a locale (immutable)', 'ota'),
    },
    '/api/projects/{projectId}/reports/progress': {
      get: p('Translation progress per locale for a branch: translated/untranslated counts, percent, and per-status breakdown (read scope)', 'reports'),
    },
    '/api/projects/{projectId}/keys': {
      get: p('List keys (supports search, tag, status and branch filters)', 'keys'),
      post: p('Create a key', 'keys', true),
    },
    '/api/projects/{projectId}/keys/{keyId}': {
      patch: p('Update a key', 'keys', true),
      delete: p('Delete a key', 'keys'),
    },
    '/api/projects/{projectId}/keys/{keyId}/tags': { patch: p('Replace key tags', 'keys', true) },
    '/api/projects/{projectId}/keys/{keyId}/comments': {
      get: p('List key comments', 'keys'),
      post: p('Add a key comment', 'keys', true),
    },
    '/api/projects/{projectId}/keys/{keyId}/comments/{commentId}': {
      delete: p('Delete a comment', 'keys'),
    },
    '/api/projects/{projectId}/keys/{keyId}/screenshots': {
      get: p('List key screenshots', 'keys'),
      post: p('Attach a screenshot', 'keys', true),
    },
    '/api/projects/{projectId}/keys/{keyId}/screenshots/{screenshotId}': {
      get: p('Get a screenshot', 'keys'),
      delete: p('Detach a screenshot', 'keys'),
    },
    '/api/projects/{projectId}/keys/{keyId}/translations': {
      put: p('Upsert a translation for a key and locale (value; for plural keys an optional pluralForms object validated against the locale CLDR categories)', 'translations', true),
    },
    '/api/projects/{projectId}/review/bulk-status': {
      post: p('Bulk-set one status for translations in a locale (review queue; requires locale write access)', 'translations', true),
    },
    '/api/projects/{projectId}/keys/{keyId}/translations/{locale}/status': {
      patch: p('Set the translation status for a locale (base statuses + project custom statuses)', 'translations', true),
    },
    '/api/projects/{projectId}/keys/{keyId}/translations/{locale}/history': {
      get: p('Translation history for a key and locale', 'translations'),
    },
    '/api/projects/{projectId}/export/{locale}': { get: p('Export a locale as JSON', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/csv': { get: p('Export a locale as CSV', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/android': { get: p('Export a locale as Android strings.xml (plural keys with stored forms as <plurals> CLDR-quantity items; plural keys without forms as plain <string>)', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/stringsdict': { get: p('Export plural keys with stored forms as an iOS .stringsdict (one-level NSStringPluralRuleType entries; plural keys without forms are omitted)', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/ios': { get: p('Export a locale as iOS .strings', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/po': { get: p('Export a locale as PO (gettext); plural keys with stored forms emit msgid_plural entries when the locale has a verified Plural-Forms table entry, otherwise a plain entry from value (lossy)', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/xliff': { get: p('Export a locale as XLIFF 1.2', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/resx': { get: p('Export a locale as RESX (.NET XML resources)', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/pot': { get: p('Export a locale as a POT (gettext template) with empty msgstr values', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/properties': { get: p('Export a locale as Java .properties', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/arb': { get: p('Export a locale as Flutter ARB (plural keys with stored forms emit one ICU plural message, variable name normalized to count)', 'import/export') },
    '/api/projects/{projectId}/export/{locale}/yaml': { get: p('Export a locale as YAML (Rails-style subset)', 'import/export') },
    '/api/projects/{projectId}/export-bundle/{format}': { get: p('Export all locales as one store-only zip (one entry per locale; same read boundary as single-locale exports)', 'import/export') },
    '/api/projects/{projectId}/import-bundle/{format}': { post: p('Import a bundle zip (application/zip body; STORE-ONLY subset - compressed/deflated archives are rejected, not decompressed): one entry per locale, per-locale partial results with skips and failures reported', 'import/export', true) },
    '/api/projects/{projectId}/import/{locale}': {
      post: p('Import translations (JSON, CSV, Android XML, iOS strings/.stringsdict, PO, XLIFF, .properties, ARB or YAML; atomic). ?dryRun=true returns the same counters without writing (no snapshot, no import run)', 'import/export', true),
    },
    '/api/projects/{projectId}/imports': { get: p('List import runs', 'import/export') },
    '/api/projects/{projectId}/tm/suggest': { get: p('Translation memory suggestions', 'translations') },
    '/api/projects/{projectId}/tm/{locale}/tmx': { get: p('Export the translation memory for a locale as TMX 1.4 (export-only)', 'translations') },
    '/api/projects/{projectId}/glossary': {
      get: p('List glossary terms', 'glossary'),
      post: p('Create a glossary term', 'glossary', true),
    },
    '/api/projects/{projectId}/glossary/{termId}': {
      patch: p('Update a glossary term', 'glossary', true),
      delete: p('Delete a glossary term', 'glossary'),
    },
    '/api/projects/{projectId}/tasks': {
      get: p('List tasks', 'tasks'),
      post: p('Create a task', 'tasks', true),
    },
    '/api/projects/{projectId}/tasks/{taskId}': {
      patch: p('Update a task', 'tasks', true),
      delete: p('Delete a task', 'tasks'),
    },
    '/api/projects/{projectId}/webhooks': {
      get: p('List webhooks', 'webhooks'),
      post: p('Create a webhook (signed HMAC delivery, pinned egress)', 'webhooks', true),
    },
    '/api/projects/{projectId}/webhooks/{hookId}': {
      patch: p('Update a webhook', 'webhooks', true),
      delete: p('Delete a webhook', 'webhooks'),
    },
    '/api/projects/{projectId}/snapshots': {
      get: p('List snapshots (manual and automatic pre-import)', 'snapshots'),
      post: p('Capture a snapshot of all keys and translations', 'snapshots', true),
    },
    '/api/projects/{projectId}/snapshots/{snapshotId}/restore': {
      post: p('Restore the project to a snapshot (atomic point-in-time recovery; fields added after a snapshot was taken - e.g. pluralForms in older snapshots - are left untouched, so a restore is not an exact historical reconstruction)', 'snapshots'),
    },
    '/api/projects/{projectId}/activity': { get: p('Project activity feed', 'projects') },
    '/api/projects/{projectId}/qa': { get: p('Run QA checks over translations', 'qa') },
    '/api/projects/{projectId}/reports/quality': { get: p('Quality dashboard: QA findings aggregated by type and locale', 'projects') },
    '/api/projects/{projectId}/reports/usage': { get: p('Usage dashboard: activity volume over a trailing window', 'projects') },
    '/api/projects/{projectId}/reports/tasks': { get: p('Task dashboard: status totals, overdue, workload per assignee', 'projects') },
  },
};
