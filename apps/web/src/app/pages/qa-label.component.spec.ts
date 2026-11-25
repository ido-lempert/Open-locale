import {QaComponent} from './qa.component';
describe('QA issue labels',()=>{
 it('keeps every known label',()=>{const c=new QaComponent({} as any,{} as any);expect(c.issueTypes.map(t=>c.label(t))).toEqual(['Untranslated','Placeholder mismatch','Too long','Whitespace','Number mismatch','HTML mismatch']);});
 it.each(['future_check','constructor','__proto__','toString','',null,undefined,0,{},['whitespace']])('uses fixed fallback without string coercion for %p',type=>{const c=new QaComponent({} as any,{} as any);expect(c.label(type)).toBe('Unknown issue');expect(c.badgeClass(type)).toBe('qa-badge qa-unknown');});
 it('does not invoke unknown coercion hooks',()=>{const type={toString:()=>{throw Error('unsafe coercion');}};expect(new QaComponent({} as any,{} as any).label(type)).toBe('Unknown issue');});
 it('keeps malformed findings raw and outside known filters',()=>{const c=new QaComponent({} as any,{} as any),rows:any[]=[{type:'future_check',key:'a',locale:'he',detail:'literal'},{type:null,key:'b',locale:'he',detail:'other'},{type:'whitespace',key:'c',locale:'he',detail:''}];c.issues.set(rows);expect(c.visibleIssues()).toBe(rows);c.setIssueType('whitespace');expect(c.visibleIssues()).toEqual([rows[2]]);c.setIssueType('');c.setQuery('literal');expect(c.visibleIssues()).toEqual([rows[0]]);expect(c.issues()).toBe(rows);});
});
