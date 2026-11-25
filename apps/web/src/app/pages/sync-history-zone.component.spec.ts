import { DatePipe } from '@angular/common';
import { SyncHistoryComponent } from './sync-history.component';
const make=()=>new SyncHistoryComponent({} as any,{} as any,'en-US');
describe('diagnostic recorded timezone display',()=>{
 it('includes medium display and explicit displayed zone without changing source instant',()=>{const c=make(),value='2026-11-25T09:00:00Z',pipe=new DatePipe('en-US');expect(c.timeLabel(value)).toBe(`${pipe.transform(value,'medium')} ${pipe.transform(value,'z')}`);expect(c.timeLabel('2026-11-25T11:00:00+02:00')).toBe(c.timeLabel(value));});
 for(const value of [undefined,null,42,true,{},[],'','  ','not-a-time'])it(`bounds invalid ${typeof value}`,()=>expect(make().timeLabel(value)).toBe('Recorded time unavailable'));
});
