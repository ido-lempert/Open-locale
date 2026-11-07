import { LoginComponent } from './login.component';
const make = (api: any) =>
  new LoginComponent(
    api,
    { navigate: jest.fn() } as any,
    { snapshot: { queryParamMap: { get: () => null } } } as any,
  );
function deferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
describe('independent login provider configuration', () => {
  it('held SAML read does not delay OIDC; disabled is not a read error', async () => {
    const wait = deferred(),
      api = {
        getSamlSpInfo: jest.fn().mockReturnValue(wait.promise),
        getOidcInfo: jest.fn().mockResolvedValue({ configured: true }),
      },
      c = make(api);
    const pending = c.ngOnInit();
    await Promise.resolve();
    expect(c.oidcConfigured()).toBe(true);
    expect(c.providerLoading()).toEqual({ oidc: false, saml: true });
    wait.resolve({ browserEnabled: false });
    await pending;
    expect(c.samlConfigured()).toBe(false);
    expect(c.providerError()).toEqual({ oidc: false, saml: false });
  });
  for (const provider of ['oidc', 'saml'] as const)
    it(`${provider} retry only rereads failed source and preserves draft/error without sign-in`, async () => {
      const wait = deferred(),
        read = jest
          .fn()
          .mockRejectedValueOnce(new Error('PRIVATE'))
          .mockReturnValueOnce(wait.promise),
        api = {
          getOidcInfo:
            provider === 'oidc'
              ? read
              : jest.fn().mockResolvedValue({ configured: true }),
          getSamlSpInfo:
            provider === 'saml'
              ? read
              : jest.fn().mockResolvedValue({ browserEnabled: true }),
          startOidc: jest.fn(),
          startSamlBrowser: jest.fn(),
          login: jest.fn(),
        },
        c = make(api);
      await c.ngOnInit();
      expect(c.providerError()[provider]).toBe(true);
      c.email = 'draft@test';
      c.password = 'draft';
      c.totpCode = '123456';
      c.error.set('password error');
      const retry = c.loadProvider(provider);
      await c.loadProvider(provider);
      expect(read).toHaveBeenCalledTimes(2);
      wait.resolve(
        provider === 'oidc' ? { configured: true } : { browserEnabled: true },
      );
      await retry;
      expect(c.providerError()[provider]).toBe(false);
      expect(c.providerLoading()[provider]).toBe(false);
      expect(c.password).toBe('draft');
      expect(c.email).toBe('draft@test');
      expect(c.totpCode).toBe('123456');
      expect(c.error()).toBe('password error');
      expect(
        provider === 'oidc' ? api.getSamlSpInfo : api.getOidcInfo,
      ).toHaveBeenCalledTimes(1);
      expect(api.login).not.toHaveBeenCalled();
      expect(api.startOidc).not.toHaveBeenCalled();
      expect(api.startSamlBrowser).not.toHaveBeenCalled();
    });
  it('busy/destroyed retries cannot read; late read cannot restore flags/error', async () => {
    const wait = deferred(),
      api = { getOidcInfo: jest.fn().mockReturnValue(wait.promise) },
      c = make(api);
    c.busy.set(true);
    await c.loadProvider('oidc');
    expect(api.getOidcInfo).not.toHaveBeenCalled();
    c.busy.set(false);
    const pending = c.loadProvider('oidc');
    c.ngOnDestroy();
    wait.resolve({ configured: true });
    await pending;
    await c.loadProvider('oidc');
    expect(api.getOidcInfo).toHaveBeenCalledTimes(1);
    expect(c.oidcConfigured()).toBe(false);
    expect(c.providerError().oidc).toBe(false);
  });
});
