import { DatePipe } from '@angular/common';
import { EditorComponent } from './editor.component';
describe('editor metadata displayed clock zone',()=>{
 it('shows medium seconds and displayed timezone for equivalent instants',()=>{const c=new EditorComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,null,'en-US'),pipe=new DatePipe('en-US'),value='2026-11-25T09:00:59Z';expect(c.editorTimeLabel(value)).toBe(`${pipe.transform(value,'medium')} ${pipe.transform(value,'z')}`);expect(c.editorTimeLabel('2026-11-25T11:00:59+02:00')).toBe(c.editorTimeLabel(value));expect(c.editorTimeLabel('2026-11-25T09:00:58Z')).not.toBe(c.editorTimeLabel(value));});
});
