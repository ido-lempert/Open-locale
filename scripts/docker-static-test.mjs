// Static verification of the Docker packaging. The dev sandbox has no Docker
// daemon, so the compose stack cannot be EXECUTED here; what can be proven
// statically is that every file and variable the stack references exists and
// that the wiring matches the app's actual boot requirements (production boot
// fails closed without JWT_SECRET and TOTP_ENCRYPTION_KEY; nginx proxies /api
// to the api service; Dockerfile COPY sources exist in the repo).
// Run: node scripts/docker-static-test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failures = 0;
process.exitCode = 1;
function check(name, cond, extra = '') {
  if (cond) console.log(`PASS ${name}`);
  else { failures += 1; console.log(`FAIL ${name} ${extra}`); }
}

const compose = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const apiDockerfile = readFileSync(join(root, 'apps/api/Dockerfile'), 'utf8');
const webDockerfile = readFileSync(join(root, 'apps/web/Dockerfile'), 'utf8');
const nginx = readFileSync(join(root, 'apps/web/nginx.conf'), 'utf8');
const dockerignore = readFileSync(join(root, '.dockerignore'), 'utf8');

// --- compose wiring ---
check('compose passes DATABASE_URL to api', /DATABASE_URL: postgresql:\/\/\$\{POSTGRES_USER\}/.test(compose));
check('compose passes JWT_SECRET to api', /JWT_SECRET: \$\{JWT_SECRET\}/.test(compose));
check('compose passes TOTP_ENCRYPTION_KEY to api (production boot fails closed without it)', /TOTP_ENCRYPTION_KEY: \$\{TOTP_ENCRYPTION_KEY\}/.test(compose));
check('compose passes CORS_ORIGIN to api', /CORS_ORIGIN:/.test(compose));
check('compose api healthcheck hits the real health route', compose.includes('/api/health'));
check('compose db has a pg_isready healthcheck', compose.includes('pg_isready'));
check('compose api waits for a healthy db', /depends_on:\s*\n\s*db:\s*\n\s*condition: service_healthy/.test(compose));
check('compose web waits for a healthy api', /web:[\s\S]*?api:\s*\n\s*condition: service_healthy/.test(compose));
check('compose references the api Dockerfile', compose.includes('apps/api/Dockerfile'));
check('compose references the web Dockerfile', compose.includes('apps/web/Dockerfile'));

// Every ${VAR} the compose file substitutes must be documented in .env.example.
const vars = [...new Set([...compose.matchAll(/\$\{([A-Z_]+)(:-[^}]*)?\}/g)].map((m) => m[1]))];
const missing = vars.filter((v) => !new RegExp(`^${v}=`, 'm').test(envExample));
check('every compose variable is documented in .env.example', missing.length === 0, `missing: ${missing.join(',')}`);

// --- Dockerfile COPY sources exist (build context paths are relative to root) ---
for (const [file, content] of [['apps/api/Dockerfile', apiDockerfile], ['apps/web/Dockerfile', webDockerfile]]) {
  const copies = [...content.matchAll(/^COPY (?!--from)(\S+(?: \S+)*?) (\S+)$/gm)];
  const missingSrc = [];
  for (const m of copies) {
    for (const src of m[1].split(' ')) {
      if (!existsSync(join(root, src))) missingSrc.push(src);
    }
  }
  check(`${file} COPY sources all exist`, missingSrc.length === 0, `missing: ${missingSrc.join(',')}`);
}

// --- Dockerfile/runtime coherence ---
check('api runtime stage installs openssl (prisma engines on alpine)', /apk add --no-cache openssl/.test(apiDockerfile));
check('api runtime runs prisma migrate deploy before serving', apiDockerfile.includes('prisma migrate deploy'));
check('api build stage generates the prisma client', apiDockerfile.includes('prisma generate'));
check('api runtime copies the built nx output', apiDockerfile.includes('/app/dist/apps/api'));
check('web runtime copies the Angular browser bundle', webDockerfile.includes('/app/dist/apps/web/browser'));

// --- nginx ---
check('nginx proxies /api to the api service', nginx.includes('proxy_pass http://api:3000'));
check('nginx SPA fallback serves index.html', nginx.includes('try_files $uri $uri/ /index.html'));

// --- build context hygiene ---
for (const entry of ['node_modules', 'dist', '.git']) {
  check(`.dockerignore excludes ${entry}`, new RegExp(`^${entry.replace('.', '\\.')}$`, 'm').test(dockerignore));
}

console.log(failures ? `docker-static: ${failures} FAILURES` : 'docker-static pass complete');
process.exit(failures ? 1 : 0);
