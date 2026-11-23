import { IdentitiesComponent } from './identities.component';
const identity = {
  id: 'known',
  issuer: 'https://issuer.test',
  email: 'metadata@test',
  createdAt: '2026-11-07T00:00:00Z',
};
const make = (api: any, router: any = { navigate: jest.fn() }) =>
  new IdentitiesComponent(api, router);
function deferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
describe('identity handler current-read and lifecycle guards', () => {
  it('rejects unlisted identity and pending/error selections/unlinks', async () => {
    const api = { unlinkIdentity: jest.fn() },
      c = make(api);
    c.identities.set([identity]);
    c.choose('known');
    expect(c.selected()).toBe('');
    c.loading.set(false);
    c.choose('missing');
    expect(c.selected()).toBe('');
    c.choose('known');
    c.password = 'local test';
    c.error.set('Unavailable');
    await c.unlink('known');
    c.error.set('');
    c.identities.set([]);
    await c.unlink('known');
    expect(api.unlinkIdentity).not.toHaveBeenCalled();
  });
  it('destroy clears sensitive local state and blocks all late handlers/requests', async () => {
    const api = { listIdentities: jest.fn(), unlinkIdentity: jest.fn() },
      c = make(api);
    c.loading.set(false);
    c.identities.set([identity]);
    c.choose('known');
    c.password = 'test password';
    c.ngOnDestroy();
    c.choose('known');
    c.password = 'captured';
    await c.unlink('known');
    await c.load();
    c.cancel();
    expect(c.selected()).toBe('');
    expect(c.identities()).toEqual([]);
    expect(api.unlinkIdentity).not.toHaveBeenCalled();
    expect(api.listIdentities).not.toHaveBeenCalled();
  });
  it('held initial read suppresses duplicates and destroyed result cannot restore identities', async () => {
    const wait = deferred(),
      api = { listIdentities: jest.fn().mockReturnValue(wait.promise) },
      c = make(api);
    const first = c.load();
    await c.load();
    expect(api.listIdentities).toHaveBeenCalledTimes(1);
    c.ngOnDestroy();
    wait.resolve([identity]);
    await first;
    expect(c.identities()).toEqual([]);
  });
  it('valid current choice still submits once and successful unlink signs out', async () => {
    const wait = deferred(),
      api = {
        token: 'session',
        unlinkIdentity: jest.fn().mockReturnValue(wait.promise),
      },
      router = { navigate: jest.fn().mockResolvedValue(true) },
      c = make(api, router);
    c.loading.set(false);
    c.identities.set([identity]);
    c.choose('known');
    c.password = 'local test';
    const first = c.unlink('known');
    await c.unlink('known');
    expect(api.unlinkIdentity).toHaveBeenCalledTimes(1);
    expect(api.unlinkIdentity).toHaveBeenCalledWith('known', 'local test');
    expect(c.password).toBe('');
    wait.resolve({ unlinked: true, signInRequired: true });
    await first;
    expect(api.token).toBeNull();
    expect(c.identities()).toEqual([]);
    expect(router.navigate).toHaveBeenCalled();
  });
  it('late successful unlink after destruction cannot navigate or change session', async () => {
    const wait = deferred(),
      api = {
        token: 'session',
        unlinkIdentity: jest.fn().mockReturnValue(wait.promise),
      },
      router = { navigate: jest.fn() },
      c = make(api, router);
    c.loading.set(false);
    c.identities.set([identity]);
    c.choose('known');
    c.password = 'local test';
    const first = c.unlink('known');
    c.ngOnDestroy();
    wait.resolve({ unlinked: true, signInRequired: true });
    await first;
    expect(api.token).toBe('session');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('explicit linked identity refresh', () => {
  it('refresh clears confirmation/password/old rows and replaces with current read without unlink', async () => {
    const wait = deferred(),
      api = {
        listIdentities: jest.fn().mockReturnValue(wait.promise),
        unlinkIdentity: jest.fn(),
      },
      c = make(api);
    c.loading.set(false);
    c.identities.set([identity]);
    c.choose(identity.id);
    c.password = 'draft';
    c.unlinkError.set('old error');
    const pending = c.load();
    await c.load();
    expect(c.selected()).toBe('');
    expect(c.password).toBe('');
    expect(c.unlinkError()).toBe('');
    expect(c.identities()).toEqual([]);
    expect(c.loading()).toBe(true);
    expect(api.listIdentities).toHaveBeenCalledTimes(1);
    wait.resolve([{ ...identity, id: 'new' }]);
    await pending;
    expect(c.identities()[0].id).toBe('new');
    expect(c.loading()).toBe(false);
    expect(api.unlinkIdentity).not.toHaveBeenCalled();
  });
  it('failed refresh leaves no stale rows and explicit next read can recover empty', async () => {
    const api = {
        listIdentities: jest
          .fn()
          .mockRejectedValueOnce(new Error('PRIVATE'))
          .mockResolvedValueOnce([]),
      },
      c = make(api);
    c.loading.set(false);
    c.identities.set([identity]);
    await c.load();
    expect(c.identities()).toEqual([]);
    expect(c.error()).not.toContain('PRIVATE');
    expect(c.error()).toContain('Could not load identities');
    expect(c.loading()).toBe(false);
    await c.load();
    expect(c.error()).toBe('');
    expect(c.identities()).toEqual([]);
    expect(api.listIdentities).toHaveBeenCalledTimes(2);
  });
  it('refresh while unlink busy cannot clear password, confirmation or issue another read', async () => {
    const api = { listIdentities: jest.fn() },
      c = make(api);
    c.loading.set(false);
    c.identities.set([identity]);
    c.choose(identity.id);
    c.password = 'draft';
    c.busy.set(true);
    await c.load();
    expect(c.password).toBe('draft');
    expect(c.selected()).toBe(identity.id);
    expect(c.identities()).toEqual([identity]);
    expect(api.listIdentities).not.toHaveBeenCalled();
  });
});

describe('linked identity recorded-time fallback',()=>{
 for(const value of [undefined,null,'','   ','not-a-date','<img src=x>',42,{},[]])it(`bounds invalid link time ${String(value)}`,()=>{expect(make({}).timeLabel(value)).toBe('Link time unavailable');});
 it('preserves exact valid locale display',()=>{const {DatePipe}=require('@angular/common'),value='2026-12-12T23:59:59.123Z',c=new IdentitiesComponent({} as any,{} as any,'en-US');expect(c.timeLabel(value)).toBe(new DatePipe('en-US').transform(value,'medium'));});
});


describe('bounded identity unlink result feedback',()=>{
 const message='Unlink result could not be confirmed. Sign in again before trying another unlink. Your password was cleared.';
 const ready=(api:any,router?:any)=>{const c=make(api,router);c.loading.set(false);c.identities.set([identity]);c.choose(identity.id);c.password='local fixture password';return c;};
 for(const error of [new Error('PRIVATE <img src=x> '+ 'X'.repeat(400)),new TypeError('PRIVATE transport failure'),'PRIVATE string',null])it(`bounds ${error instanceof Error?error.name:typeof error} without session or identity claims`,async()=>{const api={token:'session',unlinkIdentity:jest.fn().mockRejectedValue(error)},router={navigate:jest.fn()},c=ready(api,router);await c.unlink(identity.id);expect(c.unlinkError()).toBe(message);expect(c.password).toBe('');expect(c.busy()).toBe(false);expect(c.identities()).toEqual([identity]);expect(api.token).toBe('session');expect(router.navigate).not.toHaveBeenCalled();expect(api.unlinkIdentity).toHaveBeenCalledTimes(1);});
 for(const result of [null,{}, {unlinked:false,signInRequired:true},{unlinked:true,signInRequired:false}])it(`bounds malformed acknowledgement ${JSON.stringify(result)}`,async()=>{const api={token:'session',unlinkIdentity:jest.fn().mockResolvedValue(result)},c=ready(api);await c.unlink(identity.id);expect(c.unlinkError()).toBe(message);expect(c.password).toBe('');expect(api.token).toBe('session');expect(c.identities()).toEqual([identity]);});
 it('late failure cannot restore private feedback after destruction',async()=>{let reject!:(v:any)=>void;const api={unlinkIdentity:jest.fn().mockReturnValue(new Promise((_,r)=>reject=r))},c=ready(api);const pending=c.unlink(identity.id);c.ngOnDestroy();reject(new Error('PRIVATE'));await pending;expect(c.unlinkError()).toBe('');expect(c.password).toBe('');expect(c.identities()).toEqual([]);});
 it('refresh clears uncertain feedback without automatically replaying unlink',async()=>{const api={unlinkIdentity:jest.fn().mockRejectedValue(new Error('PRIVATE')),listIdentities:jest.fn().mockResolvedValue([])},c=ready(api);await c.unlink(identity.id);expect(c.unlinkError()).toBe(message);await c.load();expect(c.unlinkError()).toBe('');expect(c.identities()).toEqual([]);expect(api.unlinkIdentity).toHaveBeenCalledTimes(1);});
});
