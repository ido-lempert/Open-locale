import { DatePipe } from '@angular/common';
import { IdentitiesComponent } from './identities.component';
describe('linked identity displayed zone',()=>{
 it('adds explicit zone to same local instant without changing source',()=>{const c=new IdentitiesComponent({} as any,{} as any,'en-US'),pipe=new DatePipe('en-US'),value='2026-11-25T09:00:59Z';expect(c.timeLabel(value)).toBe(`${pipe.transform(value,'medium')} ${pipe.transform(value,'z')}`);expect(c.timeLabel('2026-11-25T11:00:59+02:00')).toBe(c.timeLabel(value));});
});
