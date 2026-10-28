// Egress hardening for webhook delivery. Members choose webhook URLs, and a
// member's project API access must never become a way to reach the server's
// internal network. Two layers:
//  1. URL string validation at create/update AND again at delivery time.
//  2. DNS resolution at delivery: every resolved address is checked against the
//     deny list before connecting, and redirects are never followed (a redirect
//     would re-open string-level bypass).
// Known residual: between lookup and connect a hostile DNS could rebind (TOCTOU).
// Fully pinning the connection to the validated address requires a custom
// connector and is ticketed; combined with redirect refusal this still blocks
// the practical internal-network attacks. Tests set WEBHOOK_ALLOW_PRIVATE_TARGETS=true
// explicitly; that escape hatch is for the local fixture receiver only.

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const BLOCKED_PORTS = new Set([22, 23, 25, 53, 111, 135, 139, 445, 2375, 3306, 5432, 6379, 9200, 11211, 27017]);

export class WebhookTargetError extends Error {}

const v4In = (ip: string, base: number[], bits: number) => {
  const parts = ip.split('.').map(Number);
  const ipNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const baseNum = ((base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3]) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
};

const V4_DENIED: [number[], number][] = [
  [[0, 0, 0, 0], 8],      // "this host"
  [[10, 0, 0, 0], 8],     // RFC1918
  [[100, 64, 0, 0], 10],  // CGNAT
  [[127, 0, 0, 0], 8],    // loopback
  [[169, 254, 0, 0], 16], // link-local (cloud metadata 169.254.169.254)
  [[172, 16, 0, 0], 12],  // RFC1918
  [[192, 0, 0, 0], 24],   // IETF protocol assignments
  [[192, 0, 2, 0], 24],   // documentation
  [[192, 168, 0, 0], 16], // RFC1918
  [[198, 18, 0, 0], 15],  // benchmarking
  [[198, 51, 100, 0], 24],// documentation
  [[203, 0, 113, 0], 24], // documentation
  [[224, 0, 0, 0], 4],    // multicast
  [[240, 0, 0, 0], 4],    // reserved
];

// Expand an IPv6 literal (including the compressed :: form) to its eight 16-bit
// groups. Returns null when the input is not parseable as IPv6.
function expandV6(ip: string): number[] | null {
  if (!ip.includes(':')) return null;
  const halves = ip.toLowerCase().split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  // A dotted-quad tail ("::ffff:127.0.0.1") contributes two groups, not one.
  const tailIsV4 = right.length > 0 && right[right.length - 1].includes('.');
  const missing = 8 - left.length - right.length - (tailIsV4 ? 1 : 0);
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  // Mixed dotted-quad tail, e.g. ::ffff:127.0.0.1: the last "group" is an IPv4
  // literal contributing the final two 16-bit groups.
  const groups: number[] = [];
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    if (part.includes('.')) {
      if (idx !== parts.length - 1 || !isIP(part)) return null;
      const b = part.split('.').map(Number);
      groups.push((b[0] << 8) | b[1], (b[2] << 8) | b[3]);
    } else {
      groups.push(parseInt(part, 16));
    }
  }
  if (groups.length !== 8) return null;
  if (groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

export function isDeniedIp(raw: string): boolean {
  const ip = raw.trim();
  if (isIP(ip) === 4) {
    return V4_DENIED.some(([base, bits]) => v4In(ip, base, bits));
  }
  const g = expandV6(ip);
  if (!g) return false;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d, normalized by the WHATWG URL parser to
  // hex groups like ::ffff:7f00:1): decode the embedded address and apply the
  // IPv4 rules - otherwise a mapped literal would smuggle a loopback past us.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return V4_DENIED.some(([base, bits]) => v4In(v4, base, bits));
  }
  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0) return true; // NAT64 WKP (embeds v4)
  if (g[0] === 0x2002) return true;            // 6to4 (embeds v4)
  if (g[0] === 0x2001 && g[1] === 0) return true;      // Teredo (embeds v4)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

// String-level checks; also run before every delivery, not only at registration.
export function validateWebhookUrlString(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebhookTargetError('Webhook URL is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebhookTargetError('Webhook URL must use http or https');
  }
  if (url.username || url.password) {
    throw new WebhookTargetError('Webhook URL must not contain credentials');
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (BLOCKED_PORTS.has(port)) {
    throw new WebhookTargetError(`Webhook port ${port} is not allowed`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // The private-target escape hatch exists for the test fixture receiver only.
  if (process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS !== 'true' && isIP(host) && isDeniedIp(host)) {
    throw new WebhookTargetError('Webhook host resolves to a denied address range');
  }
  return url;
}

// Delivery-time check: resolve the host and deny if ANY address is internal.
export async function assertResolvablePublic(url: URL): Promise<void> {
  if (process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true') return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isDeniedIp(host)) throw new WebhookTargetError('Webhook target is a denied address range');
    return;
  }
  let addresses: string[];
  try {
    addresses = (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new WebhookTargetError('Webhook host does not resolve');
  }
  if (addresses.length === 0) throw new WebhookTargetError('Webhook host does not resolve');
  if (addresses.some(isDeniedIp)) {
    throw new WebhookTargetError('Webhook host resolves to a denied address range');
  }
}
