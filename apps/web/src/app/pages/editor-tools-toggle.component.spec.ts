import { EditorComponent } from './editor.component';
const make=()=>new EditorComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any);
describe('editor tool visibility',()=>{
 it('is expanded by default and toggles without server reads or saves',()=>{const c=make();c.reload=jest.fn();c.save=jest.fn();expect(c.editorToolsExpanded()).toBe(true);c.toggleEditorTools();expect(c.editorToolsExpanded()).toBe(false);c.toggleEditorTools();expect(c.editorToolsExpanded()).toBe(true);expect(c.reload).not.toHaveBeenCalled();expect(c.save).not.toHaveBeenCalled();c.ngOnDestroy();});
 it('retains branch, filters, creation drafts, local translations and pending state',()=>{const c=make(),key={id:'k',name:'a'} as any;c.branch.set('release');c.search.set('alpha');c.filterTag.set('tag');c.newKey.set('new.key');c.newLocale.set('fr');c.edit(key,'en','keep draft');c.exportPending.set(true);c.toggleEditorTools();c.toggleEditorTools();expect(c.branch()).toBe('release');expect(c.search()).toBe('alpha');expect(c.filterTag()).toBe('tag');expect(c.newKey()).toBe('new.key');expect(c.newLocale()).toBe('fr');expect(c.cell('k','en')().value).toBe('keep draft');expect(c.exportPending()).toBe(true);c.ngOnDestroy();});
 it('departed captured handler cannot change visibility',()=>{const c=make();c.ngOnDestroy();c.toggleEditorTools();expect(c.editorToolsExpanded()).toBe(true);});
});
