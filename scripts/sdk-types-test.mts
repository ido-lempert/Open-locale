// Compile-only SDK result narrowing contract.
import { createClient, type OtaPull } from '../libs/sdk/src/index.js';
const client = createClient({ url: 'https://example.invalid', token: 'test-only' });
async function check(): Promise<void> {
  const result = await client.ota.latest('project', 'en');
  if (!result.notModified) {
    const value: string | undefined = result.bundle.translations['key'];
    const version: number = result.bundle.version;
    void value; void version;
  } else {
    // @ts-expect-error304 has no bundle to read.
    result.bundle.version;
  }
}
// @ts-expect-error Fresh response must carry bundle.
const missing: OtaPull = { notModified: false, etag: null, sha256: null };
// @ts-expect-error304 cannot carry fresh bundle.
const wrong: OtaPull = { notModified: true, etag: null, sha256: null, bundle: { version: 1, branch: 'main', translations: {} } };
void check; void missing; void wrong;
