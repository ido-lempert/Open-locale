// Pinned-transport webhook delivery. The hostname is resolved once, every
// resolved address is validated, and the actual connection is then PINNED to a
// validated address through the http/https `lookup` option: the socket dials
// the pinned IP while the Host header and (for https) TLS SNI and certificate
// validation still use the original hostname. This closes the rebind window
// between "check DNS" and "connect" - there is no second, unpinned resolution.
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

export interface DeliverResult {
  ok: boolean;
  status?: number;
  error?: string;
}

// Resolver is injectable so tests can simulate hostile/rebinding DNS.
export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

export function deliverPinned(
  url: URL,
  pinned: { address: string; family: number },
  headers: Record<string, string>,
  body: string,
  timeoutMs = 5000,
): Promise<DeliverResult> {
  return new Promise((resolve) => {
    const isTls = url.protocol === 'https:';
    // Node's http layer asks for `all: true`: honor both callback shapes so the
    // pinned address is the only address the connector can ever dial.
    const lookup: LookupFunction = (_hostname, opts, cb) =>
      (opts as { all?: boolean })?.all
        ? cb(null, [{ address: pinned.address, family: pinned.family }])
        : cb(null, pinned.address, pinned.family);
    const req = (isTls ? httpsRequest : httpRequest)(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || (isTls ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        lookup, // pinned: no second resolution can rebinding to another address
        timeout: timeoutMs,
      },
      (res) => {
        res.resume(); // drain so the socket frees
        res.on('end', () => {
          // Redirects are never followed; a 30x is a failed delivery.
          resolve({ ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('webhook delivery timed out')));
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}
