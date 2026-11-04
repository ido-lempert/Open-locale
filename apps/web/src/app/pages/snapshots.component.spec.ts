import { SnapshotsComponent } from './snapshots.component';
import { ApiService } from '../api.service';
import { ActivatedRoute } from '@angular/router';
const make=(api:any)=>new SnapshotsComponent({} as ActivatedRoute,api as ApiService);
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
describe('snapshot list recovery',()=>{
 it('clears stale rows during pending and failure then restores list without losing label or mutation error',async()=>{const wait=deferred(),api={listSnapshots:jest.fn().mockReturnValueOnce(wait.promise).mockResolvedValueOnce([{id:'fresh'}])},c=make(api);c.projectId='project';c.items.set([{id:'stale'}] as never);c.label='Draft';c.error.set('Mutation failed');const a=c.reload();expect(c.items()).toEqual([]);expect(c.loading()).toBe(true);wait.reject(new Error('private'));await a;expect(c.listError()).toBe(true);expect(c.loading()).toBe(false);expect(c.error()).toBe('Mutation failed');await c.reload();expect(c.items()[0].id).toBe('fresh');expect(c.listError()).toBe(false);expect(c.label).toBe('Draft');expect(c.error()).toBe('Mutation failed');expect(api.listSnapshots).toHaveBeenLastCalledWith('project');});
 it('late older failure cannot replace latest successful list',async()=>{const wait=deferred(),c=make({listSnapshots:jest.fn().mockReturnValueOnce(wait.promise).mockResolvedValueOnce([{id:'fresh'}])});const a=c.reload();await c.reload();wait.reject(new Error('private'));await a;expect(c.items()[0].id).toBe('fresh');expect(c.listError()).toBe(false);expect(c.loading()).toBe(false);});
 it('destroy fences pending read and suppresses later reads',async()=>{const wait=deferred(),api={listSnapshots:jest.fn().mockReturnValue(wait.promise)},c=make(api);const a=c.reload();c.ngOnDestroy();wait.resolve([{id:'old'}]);await a;await c.reload();expect(c.items()).toEqual([]);expect(api.listSnapshots).toHaveBeenCalledTimes(1);});
});
