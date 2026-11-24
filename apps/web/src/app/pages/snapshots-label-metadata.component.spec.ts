import {SnapshotsComponent} from './snapshots.component';
const make=()=>new SnapshotsComponent({} as any,{} as any);
describe('bounded loaded snapshot label metadata',()=>{
 for(const value of [undefined,null,'','  ',42,{},[]])it(`guards unavailable label ${String(value)}`,()=>{const c=make(),rows=[{id:'bad',label:value},{id:'yes',label:'Release [A]'}];expect(c.snapshotLabel(value)).toBe('Snapshot label unavailable');expect(c.validSnapshotLabel(value)).toBe(false);c.items.set(rows as any);expect(c.visibleItems()).toBe(rows);c.setSearch('release');expect(c.visibleItems().map(r=>r.id)).toEqual(['yes']);c.setSearch('unavailable');expect(c.visibleItems()).toEqual([]);c.clearFilters();expect(c.items()[0].label).toBe(value);});
 for(const value of ['Release [A]',' Exact ','עברית','<img src=x>'])it(`preserves literal valid label ${value}`,()=>{const c=make();expect(c.snapshotLabel(value)).toBe(value);expect(c.validSnapshotLabel(value)).toBe(true);});
});
