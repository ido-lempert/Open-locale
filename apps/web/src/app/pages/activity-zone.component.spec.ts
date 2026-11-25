import { DatePipe } from '@angular/common';
import { ActivityComponent } from './activity.component';
describe('explicit activity recorded time',()=>{
 it('uses medium seconds and displayed zone for equivalent instants',()=>{const c=new ActivityComponent({} as any,{} as any,'en-US'),pipe=new DatePipe('en-US'),value='2026-11-25T09:00:59Z';expect(c.timeLabel(value)).toBe(`${pipe.transform(value,'medium')} ${pipe.transform(value,'z')}`);expect(c.timeLabel('2026-11-25T11:00:59+02:00')).toBe(c.timeLabel(value));expect(c.timeLabel('2026-11-25T09:00:58Z')).not.toBe(c.timeLabel(value));});
});
