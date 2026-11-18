import {SettingsComponent} from './settings.component';
const make=()=>new SettingsComponent({} as any,{snapshot:{paramMap:{get:()=> 'p'}}} as any,{} as any);
describe('retained missing provider choice display',()=>{
 it('empty unset choice is not a missing selection',()=>{const c=make();expect(c.missingMtProvider('')).toBe(false);});
 it('exact IDs only, not names or substrings',()=>{const c=make();c.mtProviders.set([{id:'one',name:'two',type:'pseudo',enabled:true}]);expect(c.missingMtProvider('one')).toBe(false);expect(c.missingMtProvider('two')).toBe(true);expect(c.missingMtProvider('on')).toBe(true);});
 it('disabled loaded provider is not claimed missing or live-available',()=>{const c=make();c.mtProviders.set([{id:'one',name:'one',type:'pseudo',enabled:false}]);expect(c.missingMtProvider('one')).toBe(false);});
 it('missing test is read-only across both selections result and drafts',()=>{const c=make();c.mtProviderId.set('old');c.newRuleProvider.set('other');c.mtResult.set('Earlier');c.newRuleName.set('Draft');expect(c.missingMtProvider(c.mtProviderId())).toBe(true);expect(c.missingMtProvider(c.newRuleProvider())).toBe(true);expect([c.mtProviderId(),c.newRuleProvider(),c.mtResult(),c.newRuleName()]).toEqual(['old','other','Earlier','Draft']);});
 it('returned exact ID clears display predicate without replacing a choice',()=>{const c=make();c.mtProviderId.set('old');expect(c.missingMtProvider(c.mtProviderId())).toBe(true);c.mtProviders.set([{id:'old',name:'Renamed',type:'pseudo',enabled:true}]);expect(c.missingMtProvider(c.mtProviderId())).toBe(false);expect(c.mtProviderId()).toBe('old');});
});
