import { OidcCallbackComponent } from './oidc-callback.component';
import { SamlCallbackComponent } from './saml-callback.component';
function deferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
for (const [name, Component] of [
  ['oidc', OidcCallbackComponent],
  ['saml', SamlCallbackComponent],
] as const)
  describe(`${name} callback current handlers`, () => {
    const make = (api: any = {}, router: any = { navigate: jest.fn() }) =>
      new Component(api, router, {} as any);
    it('blank factor does not consume one-use pending token or issue request', async () => {
      const api = { completeOidc: jest.fn(), completeSaml: jest.fn() },
        c = make(api);
      c.busy.set(false);
      c.pendingToken = 'one-use';
      c.code = '  ';
      await c.complete();
      expect(c.pendingToken).toBe('one-use');
      expect(c.busy()).toBe(false);
      expect(api.completeOidc).not.toHaveBeenCalled();
      expect(api.completeSaml).not.toHaveBeenCalled();
    });
    it('busy and destroyed restart cannot navigate or clear pending factor', async () => {
      const router = { navigate: jest.fn() },
        c = make({}, router);
      c.pendingToken = 'one-use';
      c.code = '123';
      c.restart();
      expect(c.pendingToken).toBe('one-use');
      expect(c.code).toBe('123');
      expect(router.navigate).not.toHaveBeenCalled();
      c.ngOnDestroy();
      c.busy.set(false);
      c.pendingToken = 'captured';
      c.code = '123';
      c.restart();
      await c.complete();
      expect(router.navigate).not.toHaveBeenCalled();
    });
    it('current idle restart clears factor and navigates to login', () => {
      const router = { navigate: jest.fn() },
        c = make({}, router);
      c.busy.set(false);
      c.pendingToken = 'one-use';
      c.code = '123';
      c.restart();
      expect(c.pendingToken).toBe('');
      expect(c.code).toBe('');
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        replaceUrl: true,
      });
    });
    it('valid factor still submits once and late destroyed response cannot set session', async () => {
      const wait = deferred(),
        read = jest.fn().mockReturnValue(wait.promise),
        api = { token: 'preserved', completeOidc: read, completeSaml: read },
        router = { navigate: jest.fn() },
        c = make(api, router);
      c.busy.set(false);
      c.pendingToken = 'one-use';
      c.code = ' 123456 ';
      const pending = c.complete();
      await c.complete();
      c.restart();
      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith('one-use', '123456');
      expect(c.pendingToken).toBe('');
      expect(router.navigate).not.toHaveBeenCalled();
      c.ngOnDestroy();
      wait.resolve({ accessToken: 'late' });
      await pending;
      expect(api.token).toBe('preserved');
      expect(router.navigate).not.toHaveBeenCalled();
    });
    it('destroyed callback consumer cannot touch same-tab handoff or API', async () => {
      const api = { callbackOidc: jest.fn(), redeemSamlBrowser: jest.fn() },
        c = make(api);
      c.ngOnDestroy();
      sessionStorage.setItem('ol.oidc.state', 'preserved');
      sessionStorage.setItem('ol.saml.verifier', 'preserved');
      await (c as any)[
        name === 'oidc' ? 'consumeCallback' : 'consumeFragment'
      ]();
      expect(sessionStorage.getItem('ol.oidc.state')).toBe('preserved');
      expect(sessionStorage.getItem('ol.saml.verifier')).toBe('preserved');
      expect(api.callbackOidc).not.toHaveBeenCalled();
      expect(api.redeemSamlBrowser).not.toHaveBeenCalled();
      sessionStorage.clear();
    });
  });
