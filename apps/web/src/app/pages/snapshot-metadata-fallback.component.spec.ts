import { DatePipe } from '@angular/common';
import { SnapshotsComponent } from './snapshots.component';
const make=()=>new SnapshotsComponent({} as any,{} as any);
describe('snapshot metadata display fallback',()=>{
 for(const value of [true,false,undefined,null,'true','false',0,1])it(`classifies only strict booleans ${JSON.stringify(value)}`,()=>{expect(make().snapshotKindLabel(value)).toBe(value===true?'automatic':value===false?'manual':'unknown loaded kind');});
 for(const value of ['', '  ',undefined,null,42,{},'not-a-date','<img onerror=fail>'+ 'X'.repeat(300)])it(`unavailable capture time ${typeof value}`,()=>{expect(make().captureTimeLabel(value)).toBe('Capture time unavailable');});
 for(const value of ['2026-10-28T16:00:00.123Z','1970-01-01T00:00:00Z','2026-10-28'])it(`preserves DatePipe medium and zone display ${value}`,()=>{expect(make().captureTimeLabel(value)).toBe(new DatePipe('en-US').transform(value,'medium')+' '+new DatePipe('en-US').transform(value,'z'));});
 it('keeps raw invalid metadata and unknown kind explicit in restore identity without mutation',()=>{const c=make(),row={id:'s',label:'same',createdAt:'<img onerror=fail>',automatic:undefined,keyCount:0,translationCount:0} as any;c.label='Unsent';c.notice.set('Receipt');c.captureUnknown.set(true);c.restoreUnknown.set(true);const before=JSON.stringify(row);expect(c.captureTimeLabel(row.createdAt)).toBe('Capture time unavailable');expect(c.restoreIdentity(row)).toContain('Loaded kind: unknown loaded kind');expect(c.restoreIdentity(row)).toContain('Loaded capture time: <img onerror=fail>');expect(JSON.stringify(row)).toBe(before);expect([c.label,c.notice(),c.captureUnknown(),c.restoreUnknown()]).toEqual(['Unsent','Receipt',true,true]);});
});
