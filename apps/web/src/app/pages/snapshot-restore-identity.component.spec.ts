import {SnapshotsComponent} from './snapshots.component';
const row={id:'snap-exact',label:'Same',createdAt:'2026-10-28T16:00:00.123Z',automatic:false,keyCount:7,translationCount:12};
const make=()=>{const api={restoreSnapshot:jest.fn(),listSnapshots:jest.fn()},c=new SnapshotsComponent({} as any,api as any);c.projectId='project-exact';return {c,api};};
describe('snapshot restore loaded identity',()=>{
 it('shows exact project snapshot raw time kind and counts',()=>{const {c}=make(),s=c.restoreIdentity(row);for(const part of ['Project ID: project-exact','Snapshot ID: snap-exact',row.createdAt,'Loaded kind: manual','7 keys, 12 translations','not contents, current permission or a current-project impact scan'])expect(s).toContain(part);});
 it('distinguishes same-label snapshot identifiers',()=>{const {c}=make();expect(c.restoreIdentity(row)).not.toBe(c.restoreIdentity({...row,id:'other'}));});
 it('uses automatic kind without treating it as live impact',()=>{expect(make().c.restoreIdentity({...row,automatic:true})).toContain('Loaded kind: automatic');});
 it('preserves raw invalid capture metadata as text',()=>{expect(make().c.restoreIdentity({...row,createdAt:'<img>'+ 'X'.repeat(300)})).toContain('<img>'+ 'X'.repeat(300));});
 it('shows empty capture metadata explicitly',()=>{expect(make().c.restoreIdentity({...row,createdAt:''})).toContain('(empty loaded capture time)');});
 it('loaded counts include zero rather than implied missing data',()=>{expect(make().c.restoreIdentity({...row,keyCount:0,translationCount:0})).toContain('0 keys, 0 translations');});
 it('does not replace capture draft or change state or make requests',()=>{const {c,api}=make();c.label='Unsent';c.error.set('Independent');c.notice.set('Earlier receipt');const before=JSON.stringify(row);c.restoreIdentity(row);expect(JSON.stringify(row)).toBe(before);expect([c.label,c.error(),c.notice(),c.restoring()]).toEqual(['Unsent','Independent','Earlier receipt',false]);expect(api.restoreSnapshot).not.toHaveBeenCalled();expect(api.listSnapshots).not.toHaveBeenCalled();});
});
