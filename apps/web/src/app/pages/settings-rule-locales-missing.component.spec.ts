import {SettingsComponent} from './settings.component';
const make=()=>{const c=new SettingsComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,{} as any);c.project.set({baseLocale:'en',locales:[{code:'en'},{code:'he'}]} as any);return c;};
describe('retained missing new-rule target locales',()=>{
 it('empty or unloaded does not invent missing targets',()=>{const c=make();expect(c.missingRuleLocales()).toEqual([]);c.newRuleLocales.set(['he']);c.project.set(null);expect(c.missingRuleLocales()).toEqual([]);});
 it('exact code and non-base matching, stable unique display only',()=>{const c=make();c.newRuleLocales.set(['he','HE','en','fr','fr']);expect(c.missingRuleLocales()).toEqual(['HE','en','fr']);expect(c.newRuleLocales()).toEqual(['he','HE','en','fr','fr']);});
 it('read-only across active and inactive action',()=>{const c=make();c.newRuleLocales.set(['fr']);c.newRuleName.set('Draft');c.mtLocale.set('he');for(const action of ['pretranslate','notify']){c.newRuleAction.set(action);expect(c.missingRuleLocales()).toEqual(['fr']);}expect([c.newRuleLocales(),c.newRuleName(),c.mtLocale()]).toEqual([['fr'],'Draft','he']);});
 it('explicit existing toggle removes only matching missing draft choice',()=>{const c=make();c.newRuleLocales.set(['fr','he']);c.toggleRuleLocale('fr');expect(c.newRuleLocales()).toEqual(['he']);expect(c.missingRuleLocales()).toEqual([]);});
 it('returned exact non-base locale clears display without replacing drafts',()=>{const c=make();c.newRuleLocales.set(['fr']);c.project.update(p=>({...p!,locales:[...p!.locales,{code:'fr'} as any]}));expect(c.missingRuleLocales()).toEqual([]);expect(c.newRuleLocales()).toEqual(['fr']);});
});
