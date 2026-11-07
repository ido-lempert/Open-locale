import { LoginComponent } from './login.component';
const make = (api: any, router: any = { navigate: jest.fn() }) =>
  new LoginComponent(api, router, {
    snapshot: { queryParamMap: { get: () => null } },
  } as any);
function deferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
describe('login lifecycle', () => {
  it('destroyed or busy handlers cannot start any sign-in', async () => {
    for (const destroyed of [true, false]) {
      const api = {
          login: jest.fn(),
          signup: jest.fn(),
          startOidc: jest.fn(),
          startSamlBrowser: jest.fn(),
        },
        c = make(api);
      c.oidcConfigured.set(true);
      c.samlConfigured.set(true);
      if (destroyed) c.ngOnDestroy();
      else c.busy.set(true);
      await c.submit();
      await c.startSso();
      await c.startSaml();
      c.mode.set('signup');
      await c.submit();
      for (const method of Object.values(api))
        expect(method).not.toHaveBeenCalled();
    }
  });
  it('unconfigured providers cannot initiate starts', async () => {
    const api = { startOidc: jest.fn(), startSamlBrowser: jest.fn() },
      c = make(api);
    await c.startSso();
    await c.startSaml();
    expect(api.startOidc).not.toHaveBeenCalled();
    expect(api.startSamlBrowser).not.toHaveBeenCalled();
    expect(c.busy()).toBe(false);
  });
  for (const mode of ['login', 'signup'] as const)
    it(`${mode} pending duplicate suppressed and late response cannot sign in after destroy`, async () => {
      const wait = deferred(),
        api = {
          token: 'preserved',
          login: jest.fn().mockReturnValue(wait.promise),
          signup: jest.fn().mockReturnValue(wait.promise),
        },
        router = { navigate: jest.fn() },
        c = make(api, router);
      c.mode.set(mode);
      c.password = 'draft';
      c.totpCode = '123456';
      const pending = c.submit();
      await c.submit();
      expect(api[mode]).toHaveBeenCalledTimes(1);
      c.ngOnDestroy();
      expect(c.password).toBe('');
      expect(c.totpCode).toBe('');
      wait.resolve({ accessToken: 'late' });
      await pending;
      expect(api.token).toBe('preserved');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  it('valid current password sign-in still stores token and navigates', async () => {
    const api = {
        token: null,
        login: jest.fn().mockResolvedValue({ accessToken: 'current' }),
      },
      router = { navigate: jest.fn().mockResolvedValue(true) },
      c = make(api, router);
    c.email = 'local@test';
    c.password = 'draft';
    c.totpCode = ' 123456 ';
    await c.submit();
    expect(api.login).toHaveBeenCalledWith('local@test', 'draft', '123456');
    expect(api.token).toBe('current');
    expect(router.navigate).toHaveBeenCalledWith(['/projects']);
    expect(c.busy()).toBe(false);
  });
  it('late configuration cannot set flags after destruction', async () => {
    const wait = deferred(),
      api = {
        getSamlSpInfo: jest.fn().mockReturnValue(wait.promise),
        getOidcInfo: jest.fn(),
      },
      c = make(api);
    const pending = c.ngOnInit();
    c.ngOnDestroy();
    wait.resolve({ browserEnabled: true });
    await pending;
    expect(c.samlConfigured()).toBe(false);
    expect(api.getOidcInfo).toHaveBeenCalledTimes(1);
  });
  it('late OIDC start cannot change same-tab state', async () => {
    const wait = deferred(),
      api = { startOidc: jest.fn().mockReturnValue(wait.promise) },
      c = make(api);
    c.oidcConfigured.set(true);
    sessionStorage.setItem('ol.oidc.state', 'preserved');
    const pending = c.startSso();
    await c.startSso();
    c.ngOnDestroy();
    wait.resolve({ url: 'https://issuer.test/?state=late' });
    await pending;
    expect(api.startOidc).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('ol.oidc.state')).toBe('preserved');
    sessionStorage.removeItem('ol.oidc.state');
  });
  it('destroy during SAML digest prevents request or state write', async () => {
    const wait = deferred(),
      original = Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
      api = { startSamlBrowser: jest.fn() },
      c = make(api);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (b: Uint8Array) => b.fill(7),
        subtle: { digest: () => wait.promise },
      },
    });
    try {
      c.samlConfigured.set(true);
      const pending = c.startSaml();
      c.ngOnDestroy();
      wait.resolve(new Uint8Array(32).buffer);
      await pending;
      expect(api.startSamlBrowser).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});
