import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { SnapshotsComponent } from './snapshots.component';
import { ApiService } from '../api.service';
const row:any={id:'saved',label:'Saved'};
const make=(api:any={})=>{TestBed.configureTestingModule({providers:[{provide:ActivatedRoute,useValue:{}},{provide:ApiService,useValue:api}]});const c=TestBed.runInInjectionContext(()=>new SnapshotsComponent({} as any,api));c.projectId='project';c.loading.set(false);c.items.set([row]);return c;};
describe('bounded confirmed snapshot restore receipts',()=>{
 for(const value of [undefined,null,'2',true,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,{},[]])it(`unavailable count ${String(value)}`,()=>{const c=make();expect(c.restoreReceipt({valuesChanged:value,keysRemoved:value})).toBe('Restored: Recovered value count unavailable, Removed key count unavailable');});
 for(const value of [0,1,Number.MAX_SAFE_INTEGER])it(`exact count ${value}`,()=>expect(make().restoreReceipt({valuesChanged:value,keysRemoved:value})).toBe(`Restored: ${value} value(s) recovered, ${value} key(s) removed`));
 for(const value of [undefined,null,42,'PRIVATE',[],Object.create({valuesChanged:2,keysRemoved:3})])it(`malformed success ${String(value)}`,()=>expect(make().restoreReceipt(value)).toBe('Restored: Recovered value count unavailable, Removed key count unavailable'));
 it('independent valid fields and no extra property disclosure',()=>expect(make().restoreReceipt({valuesChanged:2,keysRemoved:'PRIVATE',extra:'PRIVATE'})).toBe('Restored: 2 value(s) recovered, Removed key count unavailable'));
 for(const failed of [false,true])it(`null confirmed response stays confirmed with follow-up read failure ${failed}`,async()=>{const confirm=jest.spyOn(window,'confirm').mockReturnValue(true);try{const api={restoreSnapshot:jest.fn().mockResolvedValue(null),listSnapshots:jest.fn().mockImplementation(()=>failed?Promise.reject(new Error('PRIVATE')):Promise.resolve([row]))},c=make(api);c.label='Keep draft';await c.restore(row);expect(c.notice()).toBe('Restored: Recovered value count unavailable, Removed key count unavailable');expect(c.restoreUnknown()).toBe(false);expect(c.restoring()).toBe(false);expect(c.error()).toBe('');expect(c.listError()).toBe(failed);expect(c.label).toBe('Keep draft');expect(api.restoreSnapshot).toHaveBeenCalledTimes(1);expect(api.listSnapshots).toHaveBeenCalledTimes(1);}finally{confirm.mockRestore();}});
});
