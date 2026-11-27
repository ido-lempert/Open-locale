// Real SDK suite startup failure must not become a successful empty run.
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
const listener = createServer();
await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '0.0.0.0', resolve); });
let failed = 0;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failed++, 'FAIL')} ${name}`);
try {
  const child = spawn('python3', ['scripts/run-reaped.py', process.execPath, 'scripts/sdk-test.mjs'], {
    env: { ...process.env, SDK_TEST_PG_PORT: String(listener.address().port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', timedOut = false;
  child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30000);
  const [status, signal] = await new Promise(resolve => child.once('close', (...args) => resolve(args)));
  clearTimeout(timer);
  check('SDK occupied PostgreSQL port causes real startup abort', output.includes('Address already in use') && output.includes('FAIL suite aborted'));
  check('SDK incomplete startup exits nonzero without timeout or signal', status !== null && status !== 0 && !signal && !timedOut);
  check('SDK aborted startup records no application PASS assertions', !/^PASS /m.test(output));
  if (failed) console.log(JSON.stringify({ status, signal, timedOut, output }));
} finally {
  await new Promise(resolve => listener.close(resolve));
}
process.exitCode = failed ? 1 : 0;
