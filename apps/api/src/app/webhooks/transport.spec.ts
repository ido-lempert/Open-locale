import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { deliverPinned } from './transport';

// Transport-level proof, not source-only: real sockets, real receiver.
describe('webhook pinned transport', () => {
  let server: Server;
  let port: number;
  const hits: { host: string | undefined; body: string }[] = [];

  beforeEach(async () => {
    hits.length = 0;
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => { hits.push({ host: req.headers.host, body }); res.writeHead(200); res.end(); });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(async () => { await new Promise((r) => server.close(r)); });

  it('dials the pinned address while preserving the original hostname in Host', async () => {
    // URL hostname differs from the dialed address: the connection must go to the
    // pinned IP (no second DNS resolution can rebinding it elsewhere).
    const url = new URL(`http://unresolvable.example.test:${port}/hook`);
    const res = await deliverPinned(url, { address: '127.0.0.1', family: 4 }, { 'X-Test': '1' }, '{"a":1}');
    expect(res.ok).toBe(true);
    expect(hits).toHaveLength(1);
    expect(hits[0].host).toBe(`unresolvable.example.test:${port}`);
    expect(hits[0].body).toBe('{"a":1}');
  });

  it('never follows redirects: a 30x is a failed delivery and the target is never contacted', async () => {
    const secondHits: unknown[] = [];
    const second = createServer((_req, res) => { secondHits.push(1); res.writeHead(200); res.end(); });
    await new Promise<void>((r) => second.listen(0, '127.0.0.1', r));
    const secondPort = (second.address() as AddressInfo).port;
    const redirector = createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${secondPort}/hook` });
      res.end();
    });
    await new Promise<void>((r) => redirector.listen(0, '127.0.0.1', r));
    const redirPort = (redirector.address() as AddressInfo).port;
    try {
      const url = new URL(`http://receiver.test:${redirPort}/hook`);
      const res = await deliverPinned(url, { address: '127.0.0.1', family: 4 }, {}, '{}');
      expect(res.ok).toBe(false);
      expect(res.status).toBe(302);
      expect(secondHits).toHaveLength(0);
    } finally {
      await new Promise((r) => redirector.close(r));
      await new Promise((r) => second.close(r));
    }
  });
});
