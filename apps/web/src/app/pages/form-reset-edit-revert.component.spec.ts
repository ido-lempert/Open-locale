import { ProjectsComponent } from './projects.component';
import { TasksComponent } from './tasks.component';
import { GlossaryComponent } from './glossary.component';
describe('form reset edit/revert cancellation',()=>{
 for(const kind of ['projects','tasks','glossary'])it(`${kind} user edit permanently cancels pending reset even after exact revert`,()=>{
  const c:any=kind==='projects'?new ProjectsComponent({} as any):kind==='tasks'?new TasksComponent({} as any,{} as any):new GlossaryComponent({} as any,{} as any);c.projectId='p';
  const field=kind==='projects'?c.name:kind==='tasks'?c.title:c.term;field.set('original');
  const ask=()=>kind==='glossary'?c.askNewTermReset():c.askDraftReset(),confirm=()=>kind==='glossary'?c.confirmNewTermReset():c.confirmDraftReset(),pending=()=>kind==='glossary'?c.newTermResetPending():c.draftResetPending();
  ask();expect(pending()).toBe(true);c.formDraftEdited();field.set('edited');c.formDraftEdited();field.set('original');expect(pending()).toBe(false);confirm();expect(field()).toBe('original');ask();confirm();expect(field()).toBe('');
 });
 for(const kind of ['projects','tasks','glossary'])it(`${kind} obsolete discard receipt cannot reappear after edit/revert`,()=>{
  const c:any=kind==='projects'?new ProjectsComponent({} as any):kind==='tasks'?new TasksComponent({} as any,{} as any):new GlossaryComponent({} as any,{} as any);c.projectId='p';const field=kind==='projects'?c.name:kind==='tasks'?c.title:c.term;field.set('original');if(kind==='glossary'){c.askNewTermReset();c.confirmNewTermReset();}else{c.askDraftReset();c.confirmDraftReset();}const notice=()=>kind==='glossary'?c.newTermResetNotice():c.draftResetNotice();expect(notice()).not.toBe('');c.formDraftEdited();field.set('edited');c.formDraftEdited();field.set('');expect(notice()).toBe('');
 });
});
