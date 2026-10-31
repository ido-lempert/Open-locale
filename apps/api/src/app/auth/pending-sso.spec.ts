import { PendingSso } from './pending-sso';

describe('bounded one-use pending SSO store', () => {
  it('retains account and epoch but exposes no expiry state', () => {
    const store = new PendingSso(1); const token = store.create('owner', 4);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(store.consume(token)).toEqual({userId:'owner',epoch:4});
    expect(()=>store.consume(token)).toThrow('Invalid or expired');
  });
  it('fails closed at capacity without replacing existing entries', () => {
    const store = new PendingSso(1); const token = store.create('owner', 1);
    expect(()=>store.create('other',2)).toThrow('Too many');
    expect(store.consume(token)).toEqual({userId:'owner',epoch:1});
    expect(()=>store.create('other',2)).not.toThrow();
  });
  it('prunes before checking capacity and expires exactly at TTL', () => {
    let now=0;const store=new PendingSso(1,100,()=>now);const token=store.create('owner',0);
    now=100;expect(()=>store.create('next',1)).not.toThrow();
    expect(()=>store.consume(token)).toThrow();
  });
  it('rejects an expired token at the boundary without needing insertion', () => {
    let now=0;const store=new PendingSso(1,100,()=>now);const token=store.create('owner',0);
    now=100;expect(()=>store.consume(token)).toThrow();
  });
  it('admits only capacity winners and consumes once under concurrent callers', async () => {
    const store=new PendingSso(2);
    const created=await Promise.allSettled(Array.from({length:20},(_,i)=>Promise.resolve().then(()=>store.create(String(i),i))));
    const tokens=created.filter((r):r is PromiseFulfilledResult<string>=>r.status==='fulfilled').map(r=>r.value);
    expect(tokens).toHaveLength(2);
    const consumed=await Promise.allSettled(Array.from({length:20},()=>Promise.resolve().then(()=>store.consume(tokens[0]))));
    expect(consumed.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  });
  it('does not allow a token from one protocol store in another', () => {
    const oidc=new PendingSso(1),saml=new PendingSso(1);const token=oidc.create('owner',0);
    expect(()=>saml.consume(token)).toThrow();expect(oidc.consume(token).userId).toBe('owner');
  });
  it('rejects invalid capacity and TTL configuration', () => {
    for(const n of [0,-1,1.5,NaN,Infinity])expect(()=>new PendingSso(n)).toThrow('bounds');
    for(const n of [0,-1,NaN,Infinity])expect(()=>new PendingSso(1,n)).toThrow('bounds');
  });
});
