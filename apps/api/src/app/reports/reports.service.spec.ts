import { ReportsService } from './reports.service';
function setup(){const prisma={activityEvent:{groupBy:jest.fn().mockResolvedValue([]),findMany:jest.fn().mockResolvedValue([])},user:{findMany:jest.fn().mockResolvedValue([])},$queryRaw:jest.fn().mockResolvedValue([])};const projects={getFor:jest.fn().mockResolvedValue({})};return {service:new ReportsService(prisma as never,projects as never,{} as never,{} as never),prisma,projects};}
describe('usage report window',()=>{
 for(const value of [NaN,Infinity,-Infinity,1.5,Number.MAX_SAFE_INTEGER+1])it(`rejects numeric ${value} before activity queries`,async()=>{const {service,prisma}=setup();await expect(service.usage('u','p',value)).rejects.toMatchObject({status:400});expect(prisma.activityEvent.groupBy).not.toHaveBeenCalled();});
 for(const [value,expected] of [[undefined,30],[0,1],[-5,1],[1,1],[90,90],[200,90]] as const)it(`maps ${value} to ${expected}`,async()=>{const {service}=setup();expect((await service.usage('u','p',value)).days).toBe(expected);});
});

describe('usage captured time bounds',()=>{
 it('all query filters share since and asOf and UTC metadata',async()=>{const {service,prisma}=setup();const result=await service.usage('u','p');const filters=[...prisma.activityEvent.groupBy.mock.calls,...prisma.activityEvent.findMany.mock.calls].map(args=>args[0].where.createdAt);expect(filters).toHaveLength(3);for(const filter of filters){expect(filter.gte).toBe(result.since);expect(filter.lte).toBe(result.asOf);}expect(result.timezone).toBe('UTC');expect(result.asOf.getTime()-result.since.getTime()).toBe(30*86400000);const sql=prisma.$queryRaw.mock.calls[0][0];expect(sql.strings.join('')).toContain("AT TIME ZONE 'UTC'");expect(sql.values).toContain(result.asOf);});
});
