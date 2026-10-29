// Pinned connector evidence, at the real connection level: local HTTP and
// HTTPS fixture servers (openssl-generated CA + certs) - no mocks of the
// network stack.
import { createServer, Server } from 'node:http';
import { createServer as createTlsServer, Server as TlsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { pinnedRequest } from './pinned';

describe('pinned egress connector', () => {
  let server: Server;
  let port: number;
  let seenHost: string | undefined;

  beforeAll(async () => {
    server = createServer((req, res) => {
      seenHost = req.headers.host;
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/elsewhere' });
        return res.end();
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        return res.end('x'.repeat(100_000));
      }
      if (req.url === '/slow') return; // never answers
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => { await new Promise((r) => server.close(r)); });

  it('pins the validated address while preserving the original Host header', async () => {
    const res = await pinnedRequest(`http://localhost:${port}/ok`, { allowPrivate: true });
    expect(res.status).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(seenHost).toBe(`localhost:${port}`);
  });

  it('denies a loopback literal without the fixture exception', async () => {
    await expect(pinnedRequest(`http://127.0.0.1:${port}/`)).rejects.toThrow(/denied address range/);
  });

  it('rejects IPv4-mapped IPv6 private literals', async () => {
    await expect(pinnedRequest('http://[::ffff:10.1.2.3]/', { allowPrivate: false })).rejects.toThrow(/denied address range/);
  });

  it('refuses to follow redirects', async () => {
    await expect(pinnedRequest(`http://127.0.0.1:${port}/redirect`, { allowPrivate: true })).rejects.toThrow(/Redirect refused/);
  });

  it('caps oversized responses', async () => {
    await expect(pinnedRequest(`http://127.0.0.1:${port}/big`, { allowPrivate: true })).rejects.toThrow(/size limit/);
  });

  it('times out', async () => {
    await expect(pinnedRequest(`http://127.0.0.1:${port}/slow`, { allowPrivate: true, timeoutMs: 300 })).rejects.toThrow(/timed out/);
  }, 10000);

  describe('TLS hostname/certificate verification (openssl fixtures)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinned-tls-'));
    const caPem = join(dir, 'ca.pem');
    const makeCert = (cn: string, san: string, out: string) => {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', join(dir, 'ca-key.pem'), '-out', caPem, '-days', '1', '-nodes', '-subj', `/CN=Test CA`], { stdio: 'pipe' });
      execFileSync('openssl', ['req', '-newkey', 'rsa:2048', '-keyout', join(dir, `${out}-key.pem`), '-out', join(dir, `${out}.csr`), '-nodes', '-subj', `/CN=${cn}`], { stdio: 'pipe' });
      const { writeFileSync } = require('node:fs');
      const ext = join(dir, `${out}.ext`);
      writeFileSync(ext, `subjectAltName=${san}\nbasicConstraints=CA:FALSE\n`);
      execFileSync('openssl', ['x509', '-req', '-in', join(dir, `${out}.csr`), '-CA', caPem, '-CAkey', join(dir, 'ca-key.pem'), '-CAcreateserial', '-out', join(dir, `${out}.pem`), '-days', '1', '-extfile', ext], { stdio: 'pipe' });
      return { key: join(dir, `${out}-key.pem`), cert: join(dir, `${out}.pem`) };
    };

    it('authenticates the original hostname over the pinned IP; rejects a mismatched cert', async () => {
      const { readFileSync } = await import('node:fs');
      const good = makeCert('localhost', 'DNS:localhost', 'good');
      const tls: TlsServer = createTlsServer({ key: readFileSync(good.key), cert: readFileSync(good.cert) }, (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"tls":true}');
      });
      await new Promise<void>((r) => tls.listen(0, '127.0.0.1', r));
      const tlsPort = (tls.address() as AddressInfo).port;
      try {
        const res = await pinnedRequest(`https://localhost:${tlsPort}/`, { allowPrivate: true, ca: readFileSync(caPem) });
        expect(res.status).toBe(200);
        expect(res.json()).toEqual({ tls: true });
      } finally {
        await new Promise((r) => tls.close(r));
      }
      // A valid certificate for a DIFFERENT hostname must fail even though
      // the connection address and CA are identical.
      const wrong = makeCert('other.example', 'DNS:other.example', 'wrong');
      const tls2: TlsServer = createTlsServer({ key: readFileSync(wrong.key), cert: readFileSync(wrong.cert) }, (_req, res) => { res.writeHead(200); res.end('{}'); });
      await new Promise<void>((r) => tls2.listen(0, '127.0.0.1', r));
      const tls2Port = (tls2.address() as AddressInfo).port;
      try {
        await expect(pinnedRequest(`https://localhost:${tls2Port}/`, { allowPrivate: true, ca: readFileSync(caPem) })).rejects.toThrow();
      } finally {
        await new Promise((r) => tls2.close(r));
      }
      // And without trusting the test CA, the valid cert must fail (default
      // CA store verification is not disabled).
      const tls3: TlsServer = createTlsServer({ key: readFileSync(good.key), cert: readFileSync(good.cert) }, (_req, res) => { res.writeHead(200); res.end('{}'); });
      await new Promise<void>((r) => tls3.listen(0, '127.0.0.1', r));
      const tls3Port = (tls3.address() as AddressInfo).port;
      try {
        await expect(pinnedRequest(`https://localhost:${tls3Port}/`, { allowPrivate: true })).rejects.toThrow();
      } finally {
        await new Promise((r) => tls3.close(r));
      }
    }, 30000);
  });
});
