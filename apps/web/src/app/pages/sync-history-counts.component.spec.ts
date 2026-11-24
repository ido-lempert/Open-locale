import {SyncHistoryComponent} from './sync-history.component';
const make=()=>new SyncHistoryComponent({} as any,{} as any);
describe('bounded diagnostic count metadata',()=>{
 for(const value of [undefined,null,'1',true,-1,0.5,Number.MAX_SAFE_INTEGER+1,{},[],NaN,Infinity])it(`rejects malformed count ${String(value)}`,()=>{const c=make();expect(c.validCount(value)).toBe(false);expect(c.countLabel(value,'keys','Key count')).toBe('Key count unavailable');expect(c.positiveCount(value)).toBe(false);const rows=[{id:'bad',summary:{total:value,conflict:value,manual:value}},{id:'yes',summary:{total:1,conflict:1,manual:1}}];c.records.set(rows as any);expect(c.filteredRecords()).toBe(rows);for(const kind of ['conflict','manual']){c.setAttention(kind);expect(c.filteredRecords().map(r=>r.id)).toEqual(['yes']);}c.clearFilters();expect(c.records()[0].summary.total).toBe(value);});
 for(const value of [0,1,Number.MAX_SAFE_INTEGER])it(`preserves valid count ${value}`,()=>{const c=make();expect(c.validCount(value)).toBe(true);expect(c.countLabel(value,'keys','Key count')).toBe(`${value} ${value===1?'key':'keys'}`);expect(c.positiveCount(value)).toBe(value>0);});
});
