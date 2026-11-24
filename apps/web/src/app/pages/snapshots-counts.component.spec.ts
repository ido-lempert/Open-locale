import {SnapshotsComponent} from './snapshots.component';
const make=()=>new SnapshotsComponent({} as any,{} as any);
describe('bounded loaded snapshot counts',()=>{
 for(const value of [undefined,null,'1',true,-1,0.5,Number.MAX_SAFE_INTEGER+1,{},[],NaN,Infinity])it(`rejects malformed count ${String(value)}`,()=>{const c=make();expect(c.validCount(value)).toBe(false);expect(c.countValue(value)).toBe('Count unavailable');expect(c.countLabel(value,'keys','Key count')).toBe('Key count unavailable');});
 for(const value of [0,1,Number.MAX_SAFE_INTEGER])it(`preserves valid count ${value}`,()=>{const c=make();expect(c.validCount(value)).toBe(true);expect(c.countValue(value)).toBe(String(value));expect(c.countLabel(value,'keys','Key count')).toBe(`${value} ${value===1?'key':'keys'}`);});
});
