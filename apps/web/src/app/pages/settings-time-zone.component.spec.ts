import { DatePipe } from '@angular/common';
import { SettingsComponent } from './settings.component';
const make=()=>new SettingsComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,{} as any,'en-US');
describe('settings clock timezone display',()=>{
 for(const format of ['short','medium'] as const)it(`adds displayed zone to ${format} and preserves equivalent instants`,()=>{const c=make(),pipe=new DatePipe('en-US'),value='2026-11-25T09:00:59Z';expect(c.settingsTimeLabel(value,format)).toBe(`${pipe.transform(value,format)} ${pipe.transform(value,'z')}`);expect(c.settingsTimeLabel('2026-11-25T11:00:59+02:00',format)).toBe(c.settingsTimeLabel(value,format));});
 it('leaves deliberately date-only creation labels date-only',()=>{const value='2026-11-25T09:00:59Z';expect(make().settingsTimeLabel(value,'mediumDate')).toBe(new DatePipe('en-US').transform(value,'mediumDate'));});
});
