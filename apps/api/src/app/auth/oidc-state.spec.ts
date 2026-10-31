import { OidcStateStore } from './oidc-state';
const value={nonce:'nonce',verifier:'secret',linkUserId:'owner',linkEpoch:7};
describe('bounded OIDC authorization state',()=>{
  it('snapshots full binding and consumes once',()=>{
    const store=new OidcStateStore(1,1000);const input={...value},key=store.create(input);input.verifier='changed';
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);expect(store.consume(key)).toEqual(value);expect(()=>store.consume(key)).toThrow();
  });
  it('refuses overflow without overwriting valid state and recovers on consume',()=>{
    const store=new OidcStateStore(1,1000),key=store.create(value);
    expect(()=>store.create({...value,linkUserId:'attacker'})).toThrow('Too many');expect(store.consume(key)).toEqual(value);expect(()=>store.create(value)).not.toThrow();
  });
  it('expires exactly at boundary and prunes before capacity check',()=>{
    let now=0;const store=new OidcStateStore(1,100,()=>now),key=store.create(value);now=100;
    expect(()=>store.consume(key)).toThrow();const next=store.create(value);now=200;expect(()=>store.create(value)).not.toThrow();expect(()=>store.consume(next)).toThrow();
  });
  it('admits capacity winners and one consumer under concurrent calls',async()=>{
    const store=new OidcStateStore(2,1000);
    const results=await Promise.allSettled(Array.from({length:20},()=>Promise.resolve().then(()=>store.create(value))));
    const keys=results.filter((r):r is PromiseFulfilledResult<string>=>r.status==='fulfilled').map(r=>r.value);expect(keys).toHaveLength(2);
    const consumes=await Promise.allSettled(Array.from({length:20},()=>Promise.resolve().then(()=>store.consume(keys[0]))));expect(consumes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  });
  it('rejects invalid cap and TTL instead of silently disabling expiry',()=>{
    for(const n of [0,-1,1.5,NaN,Infinity])expect(()=>new OidcStateStore(n,100)).toThrow('bounds');
    for(const n of [0,-1,NaN,Infinity])expect(()=>new OidcStateStore(1,n)).toThrow('bounds');
  });
});
