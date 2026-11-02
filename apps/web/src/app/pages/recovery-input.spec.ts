import { reviewedRecoveryInput } from './recovery-input';
import { RepositoryTargetConfig } from '../api.service';
const target={id:'t',revision:2,localBranch:'main',locale:'en'} as RepositoryTargetConfig;
function valid(){return {recovery:{expectedBranchId:'11111111-1111-4111-8111-111111111111',expectedKeyUpdatedAt:'2026-11-02T00:00:00.000Z',expectedKeyRevision:1,expectedValueDigest:'a'.repeat(64)},repository:{targetId:'t',targetRevision:2,branch:'main',locale:'en',baselineVersion:1,baselineSha:'b'.repeat(40),baselineDigest:'c'.repeat(64)}};}
describe('reviewed recovery preparation input',()=>{
 it('projects valid scalar input without unrelated response fields',()=>{const raw={...valid(),privateExtra:'discard'};const input=reviewedRecoveryInput(raw,target);expect(input?.confirmation).toBe('recover-local-value');expect(input?.expectedKeyRevision).toBe(1);expect(JSON.stringify(input)).not.toContain('discard');expect(input).not.toHaveProperty('targetId');});
 for(const [group,field,value] of [
 ['recovery','expectedBranchId','not-uuid'],['recovery','expectedKeyUpdatedAt','bad'],['recovery','expectedKeyUpdatedAt','2026-99-99T00:00:00.000Z'],['recovery','expectedKeyRevision',0],['recovery','expectedKeyRevision',1.5],['recovery','expectedKeyRevision',2147483648],['recovery','expectedValueDigest','bad'],
 ['repository','targetId','other'],['repository','targetRevision',3],['repository','targetRevision','2'],['repository','branch','other'],['repository','locale','fr'],['repository','baselineVersion',0],['repository','baselineSha','bad'],['repository','baselineDigest',{}],['recovery','expectedBranchId',undefined]
 ] as const)it(`rejects ${group}.${field}=${String(value)}`,()=>{const raw=valid();(raw[group] as Record<string,unknown>)[field]=value;expect(reviewedRecoveryInput(raw,target)).toBeUndefined();});
 it('rejects absent response binding objects',()=>{for(const raw of [null,{}, {recovery:null,repository:{}},{recovery:{},repository:null}])expect(reviewedRecoveryInput(raw,target)).toBeUndefined();});
});
