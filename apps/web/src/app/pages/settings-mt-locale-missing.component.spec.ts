import {SettingsComponent} from './settings.component';
const make=()=>{const c=new SettingsComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,{} as any);c.project.set({baseLocale:'en',locales:[{code:'en'},{code:'he'}]} as any);return c;};
describe('retained missing target locale display',()=>{
 it('unset or unloaded project does not invent a missing target',()=>{const c=make();expect(c.mtLocaleMissing()).toBe(false);c.mtLocale.set('he');c.project.set(null);expect(c.mtLocaleMissing()).toBe(false);});
 it('matches exact locale code only',()=>{const c=make();c.mtLocale.set('he');expect(c.mtLocaleMissing()).toBe(false);for(const code of ['h','HE','he-IL']){c.mtLocale.set(code);expect(c.mtLocaleMissing()).toBe(true);}});
 it('base locale is not a loaded target',()=>{const c=make();c.mtLocale.set('en');expect(c.mtLocaleMissing()).toBe(true);});
 it('is read-only across target provider branch result and rule drafts',()=>{const c=make();c.mtLocale.set('fr');c.mtProviderId.set('provider');c.mtBranch.set('draft');c.mtResult.set('Earlier');c.newRuleLocales.set(['fr']);expect(c.mtLocaleMissing()).toBe(true);expect([c.mtLocale(),c.mtProviderId(),c.mtBranch(),c.mtResult(),c.newRuleLocales()]).toEqual(['fr','provider','draft','Earlier',['fr']]);});
 it('returning exact non-base locale clears predicate without replacing target',()=>{const c=make();c.mtLocale.set('fr');expect(c.mtLocaleMissing()).toBe(true);c.project.update(p=>({...p!,locales:[...p!.locales,{code:'fr'} as any]}));expect(c.mtLocaleMissing()).toBe(false);expect(c.mtLocale()).toBe('fr');});
});
