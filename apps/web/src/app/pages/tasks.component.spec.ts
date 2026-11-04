import { TasksComponent } from './tasks.component';
import { ApiService } from '../api.service';
import { ActivatedRoute } from '@angular/router';
const make=(api:any)=>new TasksComponent({} as ActivatedRoute,api as ApiService);
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
describe('task list recovery',()=>{
 it('clears stale rows on pending/failure and retry retains filters and mutation errors',async()=>{const wait=deferred(),api={listTasks:jest.fn().mockReturnValueOnce(wait.promise).mockResolvedValueOnce([{id:'fresh'}])},c=make(api);c.projectId='project';c.statusFilter.set('OPEN');c.mineFilter.set('me');c.tasks.set([{id:'stale'}] as never);c.error.set('Mutation failed');const a=c.fetch();expect(c.tasks()).toEqual([]);expect(c.loading()).toBe(true);wait.reject(new Error('private'));await a;expect(c.listError()).toBe(true);expect(c.loading()).toBe(false);expect(c.error()).toBe('Mutation failed');await c.fetch();expect(api.listTasks).toHaveBeenLastCalledWith('project','OPEN',true);expect(c.tasks()[0].id).toBe('fresh');expect(c.listError()).toBe(false);expect(c.error()).toBe('Mutation failed');});
 it('late old failure cannot replace latest success or set list error',async()=>{const old=deferred(),c=make({listTasks:jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce([{id:'new'}])});const a=c.fetch();await c.fetch();old.reject(new Error('private'));await a;expect(c.tasks()[0].id).toBe('new');expect(c.listError()).toBe(false);expect(c.loading()).toBe(false);});
 it('destroy fences pending list and suppresses future reads',async()=>{const old=deferred(),api={listTasks:jest.fn().mockReturnValue(old.promise)},c=make(api);const a=c.fetch();c.ngOnDestroy();old.resolve([{id:'private'}]);await a;await c.fetch();expect(c.tasks()).toEqual([]);expect(api.listTasks).toHaveBeenCalledTimes(1);});
});
