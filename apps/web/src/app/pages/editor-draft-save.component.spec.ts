import { EditorComponent } from './editor.component';
const key={id:'A'} as any;
const make=()=>new EditorComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any);
describe('explicit cell draft save affordance',()=>{
 it('plain and plural changes show dirty and permit explicit save only when settled',()=>{const c=make();expect(c.cellDirty(key,'en')).toBe(false);c.edit(key,'en','draft');expect(c.cellDirty(key,'en')).toBe(true);expect(c.canSaveDraft(key,'en')).toBe(true);c.cell('A','en').update(x=>({...x,reviewing:true}));expect(c.canSaveDraft(key,'en')).toBe(false);c.cell('A','en').update(x=>({...x,reviewing:false,status:'saving'}));expect(c.canSaveDraft(key,'en')).toBe(false);c.cell('A','en').update(x=>({...x,status:'idle',needsReload:true}));expect(c.canSaveDraft(key,'en')).toBe(false);c.editForm(key,'he','other','many');expect(c.cellDirty(key,'he')).toBe(true);expect(c.canSaveDraft(key,'he')).toBe(true);});
 it('grid loading failed or destroyed never enables save draft',()=>{const c=make();c.edit(key,'en','draft');c.keysLoading.set(true);expect(c.canSaveDraft(key,'en')).toBe(false);c.keysLoading.set(false);c.keysError.set(true);expect(c.canSaveDraft(key,'en')).toBe(false);c.keysError.set(false);c.ngOnDestroy();expect(c.canSaveDraft(key,'en')).toBe(false);});
});
