import { DatePipe } from '@angular/common';
import { SnapshotsComponent } from './snapshots.component';
describe('snapshot capture clock identity',()=>{
 it('includes seconds and zone without changing equivalent source instants',()=>{const c=new SnapshotsComponent({} as any,{} as any,'en-US'),pipe=new DatePipe('en-US'),value='2026-11-25T09:00:59Z';expect(c.captureTimeLabel(value)).toBe(`${pipe.transform(value,'medium')} ${pipe.transform(value,'z')}`);expect(c.captureTimeLabel('2026-11-25T11:00:59+02:00')).toBe(c.captureTimeLabel(value));expect(c.captureTimeLabel('2026-11-25T09:00:58Z')).not.toBe(c.captureTimeLabel(value));});
});
