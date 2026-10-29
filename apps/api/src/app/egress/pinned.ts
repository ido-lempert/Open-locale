// Pinned egress connector: closes the lookup->connect TOCTOU window that
// plain DNS validation leaves open. The target hostname is resolved, EVERY
// resolved address is checked against the deny list, and the TCP/TLS
// connection is then made to the validated address itself - DNS is never
// consulted again for this request. TLS still authenticates the ORIGINAL
// hostname (SNI servername + default checkServerIdentity), so certificate
// verification is unaffected, and the HTTP Host header keeps the original
// host. Redirects are never followed: any 3xx is an error, because a
// redirect target would escape the pinning.
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { isDeniedIp } from '../webhooks/egress';

export class PinnedFetchError extends Error {}

export interface PinnedRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  // Fixture-only escape for loopback test targets; never honored in a
  // production boot.
  allowPrivate?: boolean;
  // Extra trust roots for tests; production uses the default CA store.
  ca?: string | Buffer | Array<string | Buffer>;
  timeoutMs?: number; // default 5000
  maxBytes?: number;  // default 65536
}

export interface PinnedResponse {
  status: number;
  text: string;
  json: () => unknown;
}

export async function pinnedRequest(rawUrl: string, opts: PinnedRequestOptions = {}): Promise<PinnedResponse> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PinnedFetchError('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new PinnedFetchError('Only http/https URLs are allowed');
  }
  if (url.username || url.password) throw new PinnedFetchError('URL must not contain credentials');
  const allowPrivate = opts.allowPrivate === true && process.env.NODE_ENV !== 'production';
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;

  // Resolve and validate EVERY address before connecting. Literal IPs skip
  // the lookup but not the deny list.
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);
  if (addresses.length === 0) throw new PinnedFetchError('DNS returned no addresses');
  if (!allowPrivate) {
    const bad = addresses.find((a) => isDeniedIp(a));
    if (bad) throw new PinnedFetchError(`Host resolves to a denied address range (${bad})`);
  }
  // Pin: connect to a validated address, never re-resolving.
  const target = addresses[0];
  const timeoutMs = opts.timeoutMs ?? 5000;
  const maxBytes = opts.maxBytes ?? 65536;
  const hostHeader = `${host.includes(':') ? `[${host}]` : host}${url.port ? `:${url.port}` : ''}`;

  return new Promise<PinnedResponse>((resolve, reject) => {
    const isTls = url.protocol === 'https:';
    const requestOptions: https.RequestOptions = {
      host: target,
      port,
      path: `${url.pathname}${url.search}`,
      method: opts.method ?? 'GET',
      headers: { host: hostHeader, connection: 'close', ...opts.headers },
      timeout: timeoutMs,
      ...(isTls
        ? {
            // Authenticate the ORIGINAL hostname while connected to the
            // pinned IP: SNI + certificate identity checks are unaffected.
            servername: isIP(host) ? undefined : host,
            rejectUnauthorized: true,
            ...(opts.ca ? { ca: opts.ca } : {}),
          }
        : {}),
    };
    const transport = isTls ? https : http;
    const req = transport.request(requestOptions, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        reject(new PinnedFetchError(`Redirect refused (${status})`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let tooBig = false;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) {
          tooBig = true;
          req.destroy();
          reject(new PinnedFetchError('Response exceeds size limit'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        if (tooBig) return;
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status, text, json: () => JSON.parse(text) });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new PinnedFetchError('Request timed out'));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
