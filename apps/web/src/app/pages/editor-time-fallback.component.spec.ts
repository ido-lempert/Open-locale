import {DatePipe} from '@angular/common';
import {EditorComponent} from './editor.component';
const make=()=>new EditorComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,null,'en-US');
describe('editor metadata timestamp fallback',()=>{
 for(const value of [undefined,null,'','  ','invalid','<img src=x>',42,{},[]])it(`bounds malformed metadata ${String(value)}`,()=>expect(make().editorTimeLabel(value)).toBe('Time unavailable'));
 it('preserves exact valid short locale format',()=>{for(const value of ['2026-12-12T23:59:59.123Z','2026-12-13T01:59:59.123+02:00'])expect(make().editorTimeLabel(value)).toBe(new DatePipe('en-US').transform(value,'short'));});
});
