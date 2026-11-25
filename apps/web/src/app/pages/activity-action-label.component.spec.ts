import { ActivityComponent } from './activity.component';
const make=()=>new ActivityComponent({} as any,{} as any);
describe('own activity action labels',()=>{
 for(const action of ['__proto__','constructor','toString','hasOwnProperty','valueOf','<img src=x>'])it(`keeps unknown action literal ${action}`,()=>{const c=make();expect(c.label(action)).toBe(action);c.items.set([{id:'row',action}] as any);c.search(action);expect(c.visibleItems().length).toBe(1);});
 for(const action of [undefined,null,42,true,{},[]])it(`bounds nonstring action ${String(action)} without coercion`,()=>{expect(make().label(action)).toBe('Action unavailable');});
 it('preserves known labels and raw source without making fallback searchable',()=>{const c=make(),rows:any=[{id:'bad',action:42},{id:'known',action:'key.created'},{id:'unknown',action:'toString'}];c.items.set(rows);expect(c.label('key.created')).toBe('created key');c.search('created key');expect(c.visibleItems()).toEqual([rows[1]]);c.search('unavailable');expect(c.visibleItems()).toEqual([]);c.search('native code');expect(c.visibleItems()).toEqual([]);c.search('');expect(c.visibleItems()).toBe(rows);expect(rows[0].action).toBe(42);});
});
