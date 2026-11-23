import {SnapshotsComponent} from './snapshots.component';
import {TasksComponent} from './tasks.component';
describe('timestamp ordering rejects coercible nonstring metadata',()=>{
 for(const value of [42,[],['2020-01-01'],{}, {toString:()=> '2020-01-01'}, {toString:()=>{throw new Error('must not coerce');}},null,undefined,'','   ']){
  it(`snapshot unavailable-last ${String(typeof value)}`,()=>{const c=new SnapshotsComponent({} as any,{} as any);c.items.set([{id:'bad',label:'bad',createdAt:value},{id:'valid',label:'valid',createdAt:'2050-01-01T00:00:00Z'}] as any);for(const order of ['newest','oldest']){c.setOrder(order);expect(c.visibleItems().map(r=>r.id)).toEqual(['valid','bad']);}expect(c.captureTimeLabel(value)).toBe('Capture time unavailable');});
  it(`task unavailable-last ${String(typeof value)}`,()=>{const c=new TasksComponent({} as any,{} as any);c.tasks.set([{id:'bad',title:'bad',dueDate:value},{id:'valid',title:'valid',dueDate:'2050-01-01T00:00:00Z'}] as any);c.order.set('due');expect(c.visibleTasks().map(r=>r.id)).toEqual(['valid','bad']);expect(c.validDueTimestamp(value)).toBe(false);});
 }
 it('preserves stable equal and unavailable ties and original source values',()=>{const c=new SnapshotsComponent({} as any,{} as any),items=[{id:'a',label:'a',createdAt:42},{id:'b',label:'b',createdAt:'2050-01-01T00:00:00Z'},{id:'c',label:'c',createdAt:[]},{id:'d',label:'d',createdAt:'2050-01-01T02:00:00+02:00'}];c.items.set(items as any);c.setOrder('oldest');expect(c.visibleItems().map(r=>r.id)).toEqual(['b','d','a','c']);expect(c.items()).toBe(items);expect(items[0].createdAt).toBe(42);});
});
