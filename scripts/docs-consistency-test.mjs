// Docs consistency: the hand-maintained OpenAPI spec must match the routes the
// controllers actually implement - both directions, no inferred completeness.
// Run: node scripts/docs-consistency-test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
const toSpec = (p) => p.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}').replace(/\/+$/, '');

// 1. Collect implemented routes from controller decorators.
const dir = join(process.cwd(), 'apps', 'src', 'app');
const appDir = join(process.cwd(), 'apps', 'api', 'src', 'app');
const implemented = new Map(); // "METHOD /api/path" -> file
for (const f of readdirSync(appDir, { recursive: true })) {
  if (!String(f).endsWith('.controller.ts')) continue;
  // The in-context embed shell is served outside /api by design (dynamic
  // per-project CSP frame-ancestors); it is not part of the documented REST
  // surface and its delivery is covered by incontext-test.mjs instead.
  if (String(f).includes('embed.controller')) continue;
  const src = readFileSync(join(appDir, f), 'utf8');
  const cm = src.match(/@Controller\('([^']*)'\)/);
  const prefix = cm ? cm[1] : '';
  for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete)\('?([^')]*)'?\)/g)) {
    const route = `/api/${[prefix, m[2]].filter(Boolean).join('/')}`;
    implemented.set(`${m[1].toUpperCase()} ${toSpec(route)}`, String(f));
  }
}

// 2. Collect documented operations from the spec source.
const specSrc = readFileSync(join(appDir, 'docs', 'openapi.ts'), 'utf8');
const documented = new Set();
const pathRe = /'(\/api\/[^']+)':\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
// Simpler: evaluate the spec object.
const { OPENAPI } = await import(join(appDir, 'docs', 'openapi.ts'));
for (const [path, ops] of Object.entries(OPENAPI.paths)) {
  for (const method of Object.keys(ops)) documented.add(`${method.toUpperCase()} ${path}`);
}
void specSrc; void pathRe; void dir;

// 3. Compare both directions. The API root (GET /api) is intentionally internal,
// as is the rendered HTML docs page (GET /api/docs): the spec documents the
// JSON API surface, and the HTML viewer is a docs surface like the root.
const internal = new Set(['GET /api', 'GET /api/docs']);
const missing = [...implemented.keys()].filter((r) => !internal.has(r) && !documented.has(r));
const phantom = [...documented].filter((r) => !implemented.has(r));
check('every implemented route is documented', missing.length === 0, missing.join(' | '));
check('no documented route is unimplemented', phantom.length === 0, phantom.join(' | '));
check('spec documents the full surface', documented.size === implemented.size - internal.size,
  `${documented.size} documented vs ${implemented.size - internal.size} implemented`);

// 4. Security consistency: every operation except the two public auth routes
//    and the spec itself must declare security.
const publicOps = new Set(['POST /api/auth/signup', 'POST /api/auth/login', 'GET /api/openapi.json', 'GET /api/auth/oidc/start', 'POST /api/auth/oidc/callback', 'POST /api/auth/oidc/complete', 'GET /api/health']);
const unsecured = [];
for (const [path, ops] of Object.entries(OPENAPI.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!publicOps.has(`${method.toUpperCase()} ${path}`) && !op.security) unsecured.push(`${method.toUpperCase()} ${path}`);
  }
}
check('every non-public operation declares security', unsecured.length === 0, unsecured.join(' | '));

console.log(failures ? `docs-consistency: ${failures} FAILURES` : 'docs-consistency pass complete');
process.exit(failures ? 1 : 0);
