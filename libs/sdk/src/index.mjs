// Open-locale SDK. Zero-dependency (node >=20, or any fetch-capable runtime).
// Thin wrapper over the REST API v1 covering the core translation workflow:
// projects, keys, translations, import/export, and OTA bundle pulls with
// integrity verification. It is NOT full API parity -
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

// sha256 over the exact response bytes, as a lowercase hex string. Uses
// WebCrypto (node >=20 and browsers both have it); node:crypto is the
// fallback for runtimes without subtle. The digest is computed over the
// utf-8 encoding of the decoded body text - OTA bundles are JSON, so the
// re-encoding reproduces the served bytes exactly (proven byte-for-byte
// against the server digest in scripts/sdk-test.mjs).
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(data).digest('hex');
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

  // OTA pulls verify the bundle before handing it to the caller: the
  // X-OpenLocale-Bundle-SHA256 header must be present and match the exact
  // bytes received, or the promise rejects - a corrupted or tampered bundle
  // is NEVER returned as data. Pass the etag from a previous pull for
  // conditional revalidation; a 304 resolves to { notModified: true } and
  // still carries the digest header, so the caller can re-verify its cached
  // copy without re-downloading.
  async function otaPull(path, etag) {
    const res = await doFetch(`${base}${path}`, {
      headers: { 'X-Api-Key': token, ...(etag ? { 'If-None-Match': etag } : {}) },
    });
    const sha256 = res.headers.get('x-openlocale-bundle-sha256');
    if (res.status === 304) return { notModified: true, etag, sha256 };
    const text = await res.text();
    if (!res.ok) {
      let json = null;
      try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
      const message = json?.message ?? `HTTP ${res.status}`;
      throw new OpenLocaleError(res.status, Array.isArray(message) ? message.join('; ') : String(message), path);
    }
    if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) {
      throw new OpenLocaleError(res.status, 'OTA bundle missing its integrity digest', path);
    }
    if ((await sha256Hex(text)) !== sha256) {
      throw new OpenLocaleError(res.status, 'OTA bundle integrity check failed: digest mismatch', path);
    }
    return { notModified: false, etag: res.headers.get('etag'), sha256, bundle: JSON.parse(text) };
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
    ota: {
      /** Latest published bundle for a locale: { notModified, etag, sha256, bundle }. */
      latest: (projectId, locale, { branch, etag } = {}) =>
        otaPull(`/projects/${projectId}/ota/latest${branchQuery(branch, { locale })}`, etag),
      /** A specific immutable version: { notModified, etag, sha256, bundle }. */
      version: (projectId, version, locale, { branch, etag } = {}) =>
        otaPull(`/projects/${projectId}/ota/${version}/${locale}${branchQuery(branch)}`, etag),
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
