// Open-locale SDK. Zero-dependency (node >=20, or any fetch-capable runtime).
// Thin wrapper over the REST API v1 covering the core translation workflow:
// projects, keys, translations, import/export. It is NOT full API parity -
// unlisted endpoints are reachable via client.request(path, options).
//
//   import { createClient } from '@open-locale/sdk';
//   const ol = createClient({ url: 'http://localhost:3000', token: process.env.OPENLOCALE_TOKEN });
//   const projects = await ol.projects.list();

export class OpenLocaleError extends Error {
  constructor(status, message, path) {
    super(message);
    this.name = 'OpenLocaleError';
    this.status = status;
    this.path = path;
  }
}

export function createClient({ url, token, fetchImpl } = {}) {
  if (!url) throw new OpenLocaleError(0, 'createClient: url is required', '');
  if (!token) throw new OpenLocaleError(0, 'createClient: token is required', '');
  const base = `${url.replace(/\/$/, '')}/api`;
  const doFetch = fetchImpl ?? fetch;

  async function request(path, { method = 'GET', body, raw = false } = {}) {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': token },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (raw) return res;
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.message ?? `HTTP ${res.status}`;
      throw new OpenLocaleError(res.status, Array.isArray(message) ? message.join('; ') : String(message), path);
    }
    return json;
  }

  const branchQuery = (branch, extra = {}) => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    for (const [k, v] of Object.entries(extra)) if (v != null) params.set(k, String(v));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  return {
    request,
    projects: {
      list: () => request('/projects'),
      get: (projectId) => request(`/projects/${projectId}`),
    },
    keys: {
      list: (projectId, { search, branch } = {}) =>
        request(`/projects/${projectId}/keys${branchQuery(branch, { search })}`),
      create: (projectId, name, { description, branch } = {}) =>
        request(`/projects/${projectId}/keys${branchQuery(branch)}`, { method: 'POST', body: { name, description } }),
    },
    translations: {
      /** Flat map of key -> value for a locale. */
      get: (projectId, locale, { branch } = {}) =>
        request(`/projects/${projectId}/export/${locale}${branchQuery(branch, { flat: 'true' })}`),
      put: (projectId, keyId, locale, value, { branch } = {}) =>
        request(`/projects/${projectId}/keys/${keyId}/translations${branchQuery(branch)}`, { method: 'PUT', body: { locale, value } }),
    },
    io: {
      /** Import a flat entries map into a locale. Set dryRun to preview without writing. */
      importEntries: (projectId, locale, entries, { branch, dryRun } = {}) =>
        request(`/projects/${projectId}/import/${locale}${branchQuery(branch, { dryRun: dryRun ? 'true' : null })}`, { method: 'POST', body: { entries } }),
      /** Export a locale in any interchange format (json|csv|android|ios|po|pot|xliff|properties|arb|yaml|resx). */
      exportText: (projectId, locale, format, { branch } = {}) =>
        request(`/projects/${projectId}/export/${locale}/${format}${branchQuery(branch)}`, { raw: true }).then(async (res) => {
          if (!res.ok) throw new OpenLocaleError(res.status, (await res.json().catch(() => ({})))?.message ?? `HTTP ${res.status}`, `/export/${locale}/${format}`);
          return res.text();
        }),
    },
  };
}
