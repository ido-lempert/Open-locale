import {DatePipe} from '@angular/common';
import {SettingsComponent} from './settings.component';
const make=()=>new SettingsComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,{} as any,'en-US');
describe('settings metadata timestamp fallback',()=>{
 for(const value of [undefined,null,'','  ','invalid','<img src=x>',42,{},[]])it(`bounds malformed metadata ${String(value)}`,()=>{for(const format of ['mediumDate','short','medium'] as const)expect(make().settingsTimeLabel(value,format)).toBe('Time unavailable');});
 it('preserves date-only format and adds zone to clock formats without source normalization',()=>{for(const value of ['2026-12-12T23:59:59.123Z','2026-12-13T01:59:59.123+02:00'])for(const format of ['mediumDate','short','medium'] as const)expect(make().settingsTimeLabel(value,format)).toBe(new DatePipe('en-US').transform(value,format)+(format==='mediumDate'?'':' '+new DatePipe('en-US').transform(value,'z')));});
});
