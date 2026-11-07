import { IdentityLinkComponent } from './identity-link.component';
const make = (provider: string, api: any) =>
  new IdentityLinkComponent(api, { snapshot: { data: { provider } } } as any);
function deferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
describe('identity linking start lifecycle', () => {
  for (const provider of ['oidc', 'saml'])
    it(`${provider} destroyed start cannot call API or clear same-tab attempt`, async () => {
      const api = { startSamlLink: jest.fn(), startOidcLink: jest.fn() },
        c = make(provider, api);
      c.loading.set(false);
      c.configured.set(true);
      c.ngOnDestroy();
      c.password = 'captured';
      const key = provider === 'saml' ? 'ol.saml.verifier' : 'ol.oidc.state';
      sessionStorage.setItem(key, 'untouched');
      await c.start();
      expect(sessionStorage.getItem(key)).toBe('untouched');
      expect(api.startSamlLink).not.toHaveBeenCalled();
      expect(api.startOidcLink).not.toHaveBeenCalled();
      sessionStorage.removeItem(key);
    });
  it('pending configuration cannot initiate link even with captured configured flag', async () => {
    const api = { startOidcLink: jest.fn() },
      c = make('oidc', api);
    c.configured.set(true);
    c.password = 'test';
    await c.start();
    expect(api.startOidcLink).not.toHaveBeenCalled();
    expect(c.busy()).toBe(false);
  });
  it('destroy during SAML digest blocks actual start request and verifier write', async () => {
    const wait = deferred(),
      original = Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
      api = { startSamlLink: jest.fn() },
      c = make('saml', api);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
        subtle: { digest: () => wait.promise },
      },
    });
    try {
      c.loading.set(false);
      c.configured.set(true);
      c.password = 'test';
      sessionStorage.setItem('ol.saml.verifier', 'old');
      const pending = c.start();
      expect(c.password).toBe('');
      expect(sessionStorage.getItem('ol.saml.verifier')).toBeNull();
      c.ngOnDestroy();
      wait.resolve(new Uint8Array(32).buffer);
      await pending;
      expect(api.startSamlLink).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('ol.saml.verifier')).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
  it('late start response after destruction cannot store new handoff', async () => {
    const wait = deferred(),
      api = { startOidcLink: jest.fn().mockReturnValue(wait.promise) },
      c = make('oidc', api);
    c.loading.set(false);
    c.configured.set(true);
    c.password = 'test';
    const pending = c.start();
    c.ngOnDestroy();
    wait.resolve({ url: 'https://issuer.test/authorize?state=late' });
    await pending;
    expect(api.startOidcLink).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('ol.oidc.state')).toBeNull();
  });
});

describe('identity provider configuration retry', () => {
  for (const provider of ['oidc', 'saml'])
    it(`${provider} failure then pending retry preserves password and never starts linking`, async () => {
      const wait = deferred(),
        read = jest
          .fn()
          .mockRejectedValueOnce(new Error('PRIVATE'))
          .mockReturnValueOnce(wait.promise),
        api = {
          getOidcInfo: read,
          getSamlSpInfo: read,
          startOidcLink: jest.fn(),
          startSamlLink: jest.fn(),
        },
        c = make(provider, api);
      await c.ngOnInit();
      expect(c.configurationError()).toBe(true);
      expect(c.error()).not.toContain('PRIVATE');
      c.password = 'local draft';
      const retry = c.loadConfiguration();
      await c.loadConfiguration();
      expect(read).toHaveBeenCalledTimes(2);
      expect(c.loading()).toBe(true);
      expect(c.configured()).toBe(false);
      expect(c.configurationError()).toBe(false);
      wait.resolve(
        provider === 'saml' ? { browserEnabled: true } : { configured: true },
      );
      await retry;
      expect(c.configured()).toBe(true);
      expect(c.error()).toBe('');
      expect(c.password).toBe('local draft');
      expect(api.startOidcLink).not.toHaveBeenCalled();
      expect(api.startSamlLink).not.toHaveBeenCalled();
    });
  it('successful disabled configuration is not a read error', async () => {
    const c = make('oidc', {
      getOidcInfo: async () => ({ configured: false }),
    });
    await c.ngOnInit();
    expect(c.loading()).toBe(false);
    expect(c.configured()).toBe(false);
    expect(c.configurationError()).toBe(false);
    expect(c.error()).toBe('');
  });
  it('destroyed or busy handlers cannot read and late configuration cannot restore state', async () => {
    const wait = deferred(),
      api = { getOidcInfo: jest.fn().mockReturnValue(wait.promise) },
      c = make('oidc', api);
    const pending = c.loadConfiguration();
    c.ngOnDestroy();
    wait.resolve({ configured: true });
    await pending;
    await c.loadConfiguration();
    expect(c.configured()).toBe(false);
    expect(api.getOidcInfo).toHaveBeenCalledTimes(1);
    const busy = make('oidc', api);
    busy.busy.set(true);
    await busy.loadConfiguration();
    expect(api.getOidcInfo).toHaveBeenCalledTimes(1);
  });
});
