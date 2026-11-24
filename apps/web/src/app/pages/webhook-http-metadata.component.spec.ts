import {WebhookDeliveriesComponent} from './webhook-deliveries.component';
const make=()=>new WebhookDeliveriesComponent({} as any,{} as any);
describe('bounded loaded HTTP status metadata',()=>{
 for(const value of [undefined,null,'','204','<img src=x>',{},[],NaN,Infinity,-1,0,99,600,200.5])it(`unavailable metadata ${String(value)}`,()=>{const c=make();expect(c.validHttpStatus(value)).toBe(false);expect(c.httpStatusLabel(value)).toBe('unavailable');c.items.set([{id:'bad',event:'test',httpStatus:value},{id:'good',event:'test',httpStatus:200}] as any);c.setHttpFilter('recorded');expect(c.visibleItems().map(r=>r.id)).toEqual(['good']);c.setHttpFilter('unavailable');expect(c.visibleItems().map(r=>r.id)).toEqual(['bad']);});
 for(const value of [100,199,200,204,301,404,503,599])it(`valid recorded status ${value}`,()=>{const c=make();expect(c.validHttpStatus(value)).toBe(true);expect(c.httpStatusLabel(value)).toBe(String(value));});
});
