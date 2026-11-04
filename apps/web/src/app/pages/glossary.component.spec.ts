import { GlossaryComponent } from './glossary.component';
import { ApiService } from '../api.service';
import { ActivatedRoute } from '@angular/router';
const make=(api:any)=>new GlossaryComponent({} as ActivatedRoute,api as ApiService);
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
describe('glossary list recovery',()=>{
 it('clears stale rows on pending/failure and retries without losing draft or mutation error',async()=>{const wait=deferred(),api={listGlossary:jest.fn().mockReturnValueOnce(wait.promise).mockResolvedValueOnce([{id:'fresh'}])},c=make(api);c.projectId='project';c.terms.set([{id:'stale'}] as never);c.term.set('Draft');c.error.set('Mutation failed');const a=c.fetch();expect(c.terms()).toEqual([]);expect(c.loading()).toBe(true);wait.reject(new Error('private'));await a;expect(c.listError()).toBe(true);expect(c.loading()).toBe(false);expect(c.error()).toBe('Mutation failed');await c.fetch();expect(c.terms()[0].id).toBe('fresh');expect(c.listError()).toBe(false);expect(c.term()).toBe('Draft');expect(c.error()).toBe('Mutation failed');expect(api.listGlossary).toHaveBeenLastCalledWith('project');});
 it('late older failure cannot replace latest successful list',async()=>{const wait=deferred(),c=make({listGlossary:jest.fn().mockReturnValueOnce(wait.promise).mockResolvedValueOnce([{id:'new'}])});const a=c.fetch();await c.fetch();wait.reject(new Error('private'));await a;expect(c.terms()[0].id).toBe('new');expect(c.listError()).toBe(false);expect(c.loading()).toBe(false);});
 it('destroy fences pending read and suppresses later read',async()=>{const wait=deferred(),api={listGlossary:jest.fn().mockReturnValue(wait.promise)},c=make(api);const a=c.fetch();c.ngOnDestroy();wait.resolve([{id:'stale'}]);await a;await c.fetch();expect(c.terms()).toEqual([]);expect(api.listGlossary).toHaveBeenCalledTimes(1);});
});
