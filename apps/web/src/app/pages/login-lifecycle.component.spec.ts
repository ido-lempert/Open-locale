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


describe('bounded provider sign-in start errors',()=>{
 let original:PropertyDescriptor|undefined;
 beforeEach(()=>{original=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:(b:Uint8Array)=>b.fill(7),subtle:{digest:async()=>new Uint8Array(32).buffer}}});});
 afterEach(()=>{if(original)Object.defineProperty(globalThis,'crypto',original);sessionStorage.clear();});
 for(const provider of ['oidc','saml']){
  const key=provider==='oidc'?'ol.oidc.state':'ol.saml.verifier',message=provider==='oidc'?'Could not start OIDC sign-in. Reload the sign-in page before trying again.':'Could not start SAML sign-in. Reload the sign-in page before trying again.';
  const ready=(start:any)=>{const api={token:'preserved',startOidc:start,startSamlBrowser:start},c=make(api);c.oidcConfigured.set(true);c.samlConfigured.set(true);return {c,api};};
  const run=(c:LoginComponent)=>provider==='oidc'?c.startSso():c.startSaml();
  for(const error of [new Error('PRIVATE <img src=x> '+ 'X'.repeat(400)),new TypeError('PRIVATE transport'),null,'PRIVATE'])it(`${provider} bounds ${error instanceof Error?error.name:typeof error} without session/write claims`,async()=>{const start=jest.fn().mockRejectedValue(error),{c,api}=ready(start);sessionStorage.setItem(key,'prior');await run(c);expect(c.error()).toBe(message);expect(c.busy()).toBe(false);expect(api.token).toBe('preserved');expect(start).toHaveBeenCalledTimes(1);expect(sessionStorage.getItem(key)).toBe('prior');});
  for(const result of [null,{}, {url:'javascript:alert(1)'},{url:'invalid'}])it(`${provider} malformed URL response gets bounded guidance`,async()=>{const {c}=ready(jest.fn().mockResolvedValue(result));await run(c);expect(c.error()).toBe(message);expect(c.busy()).toBe(false);expect(sessionStorage.getItem(key)).toBeNull();});
  it(`${provider} late rejected start cannot restore feedback after destruction`,async()=>{let reject!:(v:any)=>void;const start=jest.fn().mockReturnValue(new Promise((_,r)=>reject=r)),{c}=ready(start);const pending=run(c);await Promise.resolve();await Promise.resolve();c.ngOnDestroy();reject(new Error('PRIVATE'));await pending;expect(c.error()).toBe('');});
 }
});
