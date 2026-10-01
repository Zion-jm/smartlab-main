const express = require('express');
const actualPrisma = jest.requireActual('@prisma/client');
const failure = new actualPrisma.Prisma.PrismaClientInitializationError('PRIVATE database connection data', 'test');
const model = () => new Proxy({}, { get: (_t, name) => jest.fn(async () => { throw failure; }) });
const mockDb = new Proxy({}, { get: (_t, name) => name === '$transaction' ? async fn => fn(mockDb) : model() });
jest.mock('@prisma/client', () => ({ ...jest.requireActual('@prisma/client'), PrismaClient: jest.fn(() => mockDb) }));
jest.mock('../dist/middleware/auth', () => ({ authenticateToken: (req,_res,next) => {req.user={id:'actor',role:'ADMIN'};next()},authorizeRoles:()=> (_req,_res,next)=>next() }));
const { errorResponseContract, errorHandler } = require('../dist/middleware/errors');
const { DomainError, ValidationError, mapError } = require('../dist/services/domainError');
let server,base;
beforeAll(async()=>{const app=express();app.use(errorResponseContract);app.use(express.json());
 for(const name of ['academicDirectory','equipment','users','borrowRequests','labSchedules','conflicts','equipmentConflicts','equipmentAdjustments','notifications','reports','academicPeriod','auditLogs','auth'])app.use('/'+name,require('../dist/routes/'+name).default);
 app.get('/domain/:status', (req,_res,next)=>next(new DomainError(Number(req.params.status),'Safe domain message')));
 app.get('/unexpected',(_req,_res,next)=>next(new Error('PRIVATE SQL password')));app.use(errorHandler);
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base='http://127.0.0.1:'+server.address().port;});
afterAll(()=>new Promise(resolve=>server.close(resolve)));
const request=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
test.each(['/academicDirectory','/equipment','/users','/borrowRequests','/labSchedules','/notifications','/academicPeriod','/auditLogs','/auth/me','/reports/equipment.pdf'])('%s database failures are 503 with safe consistent errors',async path=>{const r=await request(path);expect(r.status).toBe(503);expect(r.body).toEqual({error:'Service unavailable. Please try again.',code:'SERVICE_UNAVAILABLE'});});
test.each([400,401,403,404,409,503])('typed domain status %i preserved',async status=>{const r=await request('/domain/'+status);expect(r.status).toBe(status);expect(r.body.error).toBe('Safe domain message');expect(typeof r.body.code).toBe('string')});
test('unexpected error is redacted 500',async()=>{expect(await request('/unexpected')).toEqual({status:500,body:{error:'Internal server error.',code:'INTERNAL_ERROR'}})});
test('malformed JSON is 400',async()=>{const r=await fetch(base+'/equipment',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});expect(r.status).toBe(400);expect(await r.json()).toEqual({error:'Invalid JSON body.',code:'VALIDATION_ERROR'})});
test.each([
 ['/equipment',{}],['/users',{}],['/conflicts/check',{}],['/equipmentAdjustments/adjust-equipment',{}],['/auth/login',{}]
])('%s validation response has error and code',async(path,body)=>{const r=await request(path,'POST',body);expect(r.status).toBe(400);expect(r.body).toMatchObject({code:'VALIDATION_ERROR',error:expect.any(String)})});
test('failed room conflict lookup never returns available',async()=>{const r=await request('/conflicts/check','POST',{roomId:'r',academicYearId:'y',termId:'t',scheduleType:'ONE_TIME',scheduleDate:'2037-06-12',timeStart:'2037-06-12T08:00:00+08:00',timeEnd:'2037-06-12T09:00:00+08:00'});expect(r.status).toBe(503);expect(r.body.hasConflicts).toBeUndefined()});
test('failed equipment lookup never returns available',async()=>{const r=await request('/equipmentConflicts/conflicts','POST',{academicYearId:'y',termId:'t',date:'2037-06-12',timeStart:'08:00',timeEnd:'09:00',equipment:[{equipmentId:'e',requestedQuantity:1}]});expect(r.status).toBe(503);expect(r.body.hasConflicts).toBeUndefined()});
test.each([['P2002',409],['P2025',404],['P2003',409],['P2034',409],['P2024',503],['P2010',500]])('Prisma %s maps to %i without details', (code,status)=>{const result=mapError(new actualPrisma.Prisma.PrismaClientKnownRequestError('PRIVATE SQL',{code,clientVersion:'test'}));expect(result.status).toBe(status);expect(JSON.stringify(result)).not.toContain('PRIVATE')});
test('Prisma validation bugs stay server errors',()=>{expect(mapError(new actualPrisma.Prisma.PrismaClientValidationError('PRIVATE',{clientVersion:'test'})).status).toBe(500)});
test('calendar errors are typed',()=>{expect(()=>require('../dist/utils/manilaTime').manilaDayBounds('invalid')).toThrow(ValidationError)});
