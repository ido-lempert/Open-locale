import {SyncHistoryComponent} from './sync-history.component';
const make=()=>new SyncHistoryComponent({} as any,{} as any);
describe('bounded diagnostic caller metadata',()=>{
 for(const field of ['branch','locale','remoteSha','fingerprint'])for(const value of [undefined,null,'','  ',42,{},[]])it(`guards ${field} ${String(value)}`,()=>{const c=make(),row={id:'bad',branch:'',locale:'',remoteSha:'',fingerprint:'',[field]:value};c.records.set([row] as any);expect(c.validMetadata(value)).toBe(false);expect(c.metadataLabel(value,'Field')).toBe('Field unavailable');expect(c.filteredRecords()).toHaveLength(1);c.query.set('missing');expect(c.filteredRecords()).toEqual([]);c.query.set('unavailable');expect(c.filteredRecords()).toEqual([]);c.clearFilters();expect(c.records()[0]).toBe(row);expect((c.records()[0] as any)[field]).toBe(value);});
 for(const value of ['main',' AABB ','עברית','<img src=x>'])it(`preserves exact nonempty literal ${value}`,()=>{const c=make();expect(c.metadataLabel(value,'Field')).toBe(value);c.records.set([{id:'a',branch:value,locale:'',remoteSha:'',fingerprint:''}] as any);c.query.set(value.trim().toLowerCase());expect(c.filteredRecords()).toHaveLength(1);});
});
