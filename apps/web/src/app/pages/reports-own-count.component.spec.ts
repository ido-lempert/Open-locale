import { ReportsComponent } from './reports.component';
const make=()=>new ReportsComponent({} as any,{} as any);
describe('own report count entries',()=>{
 for(const key of ['toString','constructor','__proto__','hasOwnProperty','valueOf','OPEN','future'])it(`missing ${key} is zero not inherited data`,()=>expect(make().ownCount({},key)).toBe(0));
 for(const key of ['toString','constructor','__proto__','OPEN','future'])it(`preserves own ${key} without modifying source`,()=>{const counts=JSON.parse('{"'+key+'":7}'),before=JSON.stringify(counts);expect(make().ownCount(counts,key)).toBe(7);expect(JSON.stringify(counts)).toBe(before);});
 it('preserves nullish fallback and zero with no API or state effect',()=>{const c=make(),counts:any={zero:0,nil:null,missing:undefined},report:any={locales:[]};c.report.set(report);for(const key of ['zero','nil','missing'])expect(c.ownCount(counts,key)).toBe(0);expect(c.ownCount(null,'OPEN')).toBe(0);expect(c.ownCount(undefined,'OPEN')).toBe(0);expect(c.report()).toBe(report);});
 it('ignores inherited ordinary counts as well as object prototype names',()=>{const counts=Object.create({OPEN:99});counts.DONE=2;expect(make().ownCount(counts,'OPEN')).toBe(0);expect(make().ownCount(counts,'DONE')).toBe(2);});
});
