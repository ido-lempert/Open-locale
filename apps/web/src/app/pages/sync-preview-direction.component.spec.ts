import { SyncPreviewComponent } from './sync-preview.component';
const make=()=>new SyncPreviewComponent({} as any,{} as any);
describe('bounded sync direction display',()=>{
 for(const [value,label] of [['none','No change'],['push','Local to remote'],['pull','Remote to local'],['manual','Manual review']])it(`keeps known direction ${value}`,()=>expect(make().direction(value)).toBe(label));
 for(const value of ['toString','constructor','__proto__','hasOwnProperty','valueOf','future-direction','<img src=x>',''])it(`preserves unknown string ${value}`,()=>expect(make().direction(value)).toBe(value));
 for(const value of [undefined,null,42,true,{},[]])it(`bounds malformed ${String(value)}`,()=>expect(make().direction(value)).toBe('Direction unavailable'));
 it('does not coerce objects or alter preview, selections or draft',()=>{const c=make(),value={toString:()=>{throw new Error('coercion');}},plan:any={decisions:[{key:'a',suggested:'toString',kind:'conflict'}]};c.result.set(plan);c.choices.set(new Map([['a','local']]));const draft:any={json:'{}'};c.draft.set(draft);expect(c.direction(value)).toBe('Direction unavailable');expect(c.result()).toBe(plan);expect(c.choices().get('a')).toBe('local');expect(c.draft()).toBe(draft);});
});
