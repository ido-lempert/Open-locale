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


for(const [provider,Component] of [['oidc',OidcCallbackComponent],['saml',SamlCallbackComponent]] as const)describe(`${provider} bounded callback redemption feedback`,()=>{
 const message='Could not finish single sign-on. Return to sign-in to start again. If you were linking an identity, check linked identities after signing in; this error does not undo a validated link.';
 const key=provider==='oidc'?'ol.oidc.state':'ol.saml.verifier';
 const ready=(read:any)=>{window.history.replaceState({},'',provider==='oidc'?'/auth/oidc/callback?state=local-state&code=local-code':'/auth/saml/callback#code=local-code');sessionStorage.setItem(key,'local-state');const api={token:'preserved',callbackOidc:read,redeemSamlBrowser:read},router={navigate:jest.fn()},c=new Component(api as any,router as any,{} as any);return {c,api,router};};
 const consume=(c:any)=>c[provider==='oidc'?'consumeCallback':'consumeFragment']();
 afterEach(()=>{sessionStorage.clear();window.history.replaceState({},'','/');});
 for(const error of [new Error('PRIVATE <img src=x> '+ 'X'.repeat(400)),new TypeError('PRIVATE transport'),null,'PRIVATE'])it(`bounds ${error instanceof Error?error.name:typeof error} without session or link claims`,async()=>{const read=jest.fn().mockRejectedValue(error),{c,api,router}=ready(read);await consume(c);expect(c.error()).toBe(message);expect(c.busy()).toBe(false);expect(c.pendingToken).toBe('');expect(api.token).toBe('preserved');expect(router.navigate).not.toHaveBeenCalled();expect(sessionStorage.getItem(key)).toBeNull();expect(window.location.search+window.location.hash).toBe('');expect(read).toHaveBeenCalledTimes(1);});
 for(const result of [null,{}, {requiresTwoFactor:true}])it(`bounds incomplete callback ${JSON.stringify(result)}`,async()=>{const {c,api}=ready(jest.fn().mockResolvedValue(result));await consume(c);expect(c.error()).toBe(message);expect(api.token).toBe('preserved');expect(c.pendingToken).toBe('');});
 it('preserves successful factor handoff without claiming completed sign-in',async()=>{const {c,api,router}=ready(jest.fn().mockResolvedValue({requiresTwoFactor:true,pendingToken:'one-use'}));await consume(c);expect(c.pendingToken).toBe('one-use');expect(c.error()).toBe('');expect(api.token).toBe('preserved');expect(router.navigate).not.toHaveBeenCalled();});
 it('late rejection cannot restore error after destruction',async()=>{let reject!:(v:any)=>void;const read=jest.fn().mockReturnValue(new Promise((_,r)=>reject=r)),{c}=ready(read);const pending=consume(c);c.ngOnDestroy();reject(new Error('PRIVATE'));await pending;expect(c.error()).toBe('');expect(c.pendingToken).toBe('');});
 it('preserves fixed local provider-error guidance without echoing response detail',async()=>{const read=jest.fn().mockResolvedValue({error:'PRIVATE issuer/XML detail'}),{c}=ready(read);if(provider==='oidc')window.history.replaceState({},'','/auth/oidc/callback?state=local-state&error=PRIVATE');await consume(c);expect(c.error()).toBe(provider==='oidc'?'The identity provider did not complete sign-in. Please try again.':'SAML sign-in could not be verified. Return to sign-in and try again.');expect(c.error()).not.toContain('PRIVATE');expect(read).toHaveBeenCalledTimes(provider==='oidc'?0:1);});
 it('missing local state makes no redemption request and shows bounded restart guidance',async()=>{const read=jest.fn(),{c}=ready(read);sessionStorage.removeItem(key);await consume(c);expect(c.error()).toContain('not started in this tab');expect(read).not.toHaveBeenCalled();});
});
