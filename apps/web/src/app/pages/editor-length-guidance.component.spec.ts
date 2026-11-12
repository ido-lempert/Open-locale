import {EditorComponent} from './editor.component';
const make=()=>new EditorComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any);
describe('loaded key length advisory',()=>{
 for(const value of [null,undefined,0,-1,1.5,NaN,Infinity,'3',Number.MAX_SAFE_INTEGER+1])it(`omits unavailable/invalid limit ${String(value)}`,()=>{expect(make().loadedLengthLimit({maxLength:value} as any)).toBeNull();});
 it('uses positive safe integer without changing local text/forms or save readiness',()=>{const c=make(),k={id:'k',maxLength:3} as any;const text='😀é <b>';c.edit(k,'he',text);c.editForm(k,'he','other',text);expect(c.loadedLengthLimit(k)).toBe(3);expect(c.cell('k','he')().value).toBe(text);expect(c.cell('k','he')().value.length).toBe(8);expect(c.cell('k','he')().forms.other).toBe(text);expect(c.cellDirty(k,'he')).toBe(true);expect(c.cell('k','he')().needsReload).toBeUndefined();});
});
