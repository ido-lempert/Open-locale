import { BoundedSamlCache } from './saml-cache';

describe('BoundedSamlCache public CacheProvider contract', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1000); });
  afterEach(() => jest.useRealTimers());
  it('refuses full request cache and recovers after TTL without a read', async () => {
    const cache = new BoundedSamlCache(1, 100);
    await cache.saveAsync('a', 'one');
    await expect(cache.saveAsync('b', 'two')).rejects.toThrow('full');
    jest.setSystemTime(1100);
    expect(await cache.saveAsync('b', 'two')).toEqual({ value: 'two', createdAt: 1100 });
  });
  it('does not overrun the cap under concurrent saves', async () => {
    const cache = new BoundedSamlCache(2, 100);
    const results = await Promise.allSettled(Array.from({length:20}, (_,i)=>cache.saveAsync(String(i),'v')));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(2);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(18);
  });
  it('rejects replay overflow then recovers at assertion expiry', async () => {
    const cache = new BoundedSamlCache(1, 100);
    expect(await cache.saveIfAbsentAsync('assertion-a','seen',1050)).toBe(true);
    expect(await cache.saveIfAbsentAsync('assertion-b','seen',1200)).toBe(false);
    jest.setSystemTime(1050);
    expect(await cache.saveIfAbsentAsync('assertion-b','seen',1200)).toBe(true);
  });
  it('admits one concurrent insertion of a replay key', async () => {
    const cache = new BoundedSamlCache(2,100);
    const results = await Promise.all(Array.from({length:20},()=>cache.saveIfAbsentAsync('same','v',1200)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('has a single consume winner and rejects expiry at the boundary', async () => {
    const cache = new BoundedSamlCache(2,100);
    await cache.saveAsync('request','v');
    expect(await Promise.all([cache.consumeAsync('request'),cache.consumeAsync('request')])).toEqual(['v',null]);
    await cache.saveAsync('expired','v'); jest.setSystemTime(1100);
    expect(await cache.consumeAsync('expired')).toBeNull();
  });
  it('does not overwrite existing values or extend their TTL', async () => {
    const cache = new BoundedSamlCache(1,100);
    await cache.saveAsync('a','one');
    expect(await cache.saveAsync('a','two')).toBeNull();
    expect(await cache.getAsync('a')).toBe('one');
    jest.setSystemTime(1100); expect(await cache.getAsync('a')).toBeNull();
  });
  it('implements removeAsync key/null semantics', async () => {
    const cache = new BoundedSamlCache(1,100);
    await cache.saveAsync('a','v'); expect(await cache.removeAsync('a')).toBe('a');
    expect(await cache.removeAsync('a')).toBeNull(); expect(await cache.removeAsync(null)).toBeNull();
  });
  it('rejects invalid bounds and expired replay timestamps', async () => {
    expect(()=>new BoundedSamlCache(0,100)).toThrow();
    expect(()=>new BoundedSamlCache(Infinity,100)).toThrow();
    expect(()=>new BoundedSamlCache(1,0)).toThrow();
    const cache = new BoundedSamlCache(1,100);
    expect(await cache.saveIfAbsentAsync('a','v',1000)).toBe(false);
    expect(await cache.saveIfAbsentAsync('a','v',NaN)).toBe(false);
  });
});
