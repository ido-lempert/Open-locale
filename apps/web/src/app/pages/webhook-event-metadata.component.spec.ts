import {WebhookDeliveriesComponent} from './webhook-deliveries.component';
const make=()=>new WebhookDeliveriesComponent({} as any,{} as any);
describe('bounded loaded event metadata',()=>{
 for(const value of [undefined,null,'','  ',42,{},[]])it(`bounds unavailable event ${String(value)}`,()=>{const c=make();expect(c.validEvent(value)).toBe(false);expect(c.eventLabel(value)).toBe('Event name unavailable');c.items.set([{id:'bad',event:value},{id:'valid',event:'translation.updated'}] as any);expect(c.visibleItems()).toHaveLength(2);c.setQuery('translation');expect(c.visibleItems().map(r=>r.id)).toEqual(['valid']);c.setQuery('unavailable');expect(c.visibleItems()).toEqual([]);});
 for(const value of ['translation.updated',' X.Y ','<img src=x>', 'עברית'])it(`keeps valid literal event ${value}`,()=>{const c=make();expect(c.eventLabel(value)).toBe(value);expect(c.validEvent(value)).toBe(true);});
 it('filter clearing recovers malformed rows without changing source metadata',()=>{const c=make(),rows=[{id:'bad',event:{}},{id:'valid',event:'translation.updated'}];c.items.set(rows as any);c.setQuery('translation');expect(c.visibleItems()).toHaveLength(1);c.clearFilters();expect(c.visibleItems()).toBe(rows);expect(c.items()[0].event).toBe(rows[0].event);});
});
