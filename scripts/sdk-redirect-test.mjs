// Real local redirect probe, fake token only. No external network.
import { createServer } from 'node:http';
import { createClient } from '../libs/sdk/src/index.mjs';
let targetRequests = 0, tokenSeen = false, failures = 0, redirectStatus = 302, sameOrigin = false;
const target = createServer((req, res) => { targetRequests++; tokenSeen ||= req.headers['x-api-key'] === 'fake-redirect-test'; res.setHeader('Content-Type', 'application/json'); res.end('{}'); });
const origin = createServer((req, res) => {
  if (req.url === '/destination') { targetRequests++; tokenSeen ||= req.headers['x-api-key'] === 'fake-redirect-test'; res.end('{}'); return; }
  res.writeHead(redirectStatus, { Location: sameOrigin ? '/destination' : `http://127.0.0.1:${target.address().port}/destination` }); res.end();
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
try {
  await listen(target); await listen(origin);
  const client = createClient({ url: `http://127.0.0.1:${origin.address().port}`, token: 'fake-redirect-test' });
  for (const status of [301, 302, 303, 307, 308]) {
    redirectStatus = status;
    for (const local of [false, true]) {
      sameOrigin = local;
      for (const [label, run] of [
        ['request', () => client.projects.list()],
        ['OTA', () => client.ota.latest('project', 'en')],
        ['raw export', () => client.io.exportText('project', 'en', 'po')],
        ['import write', () => client.io.importEntries('project', 'en', { 'private-test-only': 'fake-text' })],
        ['translation write', () => client.translations.put('project', 'key', 'en', 'fake-text')],
      ]) {
        targetRequests = 0; tokenSeen = false;
        const error = await run().then(() => null).catch(e => e);
        check(`${status} ${local ? 'same' : 'cross'} origin ${label} rejects redirect`, !!error);
        check(`${status} ${local ? 'same' : 'cross'} origin ${label} target receives no token or body`, targetRequests === 0 && !tokenSeen);
      }
    }
  }

} finally {
  origin.closeAllConnections(); target.closeAllConnections();
  await Promise.all([origin, target].map(server => new Promise(resolve => server.close(resolve))));
}
process.exitCode = failures ? 1 : 0;
