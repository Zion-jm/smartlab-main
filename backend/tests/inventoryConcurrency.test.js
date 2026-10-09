const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { apiRequest, loginAs, BASE_URL } = require('./helpers');

describe('Inventory concurrency on local smartlab_test', () => {
  let prisma, admin, token, year, term;
  const requests = [], equipment = [];
  const tag = 'inventory-race-' + Date.now();
  beforeAll(async () => {
    let db, api;
    try { db = new URL(process.env.DATABASE_URL); api = new URL(BASE_URL); } catch { throw new Error('Invalid local test configuration'); }
    if (!['localhost','127.0.0.1'].includes(db.hostname) || db.pathname !== '/smartlab_test' || !['localhost','127.0.0.1'].includes(api.hostname)) throw new Error('Local smartlab_test and API required');
    prisma = new PrismaClient();
    year = await prisma.academicYear.findFirst({ where: { isActive: true } });
    term = await prisma.term.findFirst({ where: { isActive: true } });
    if (!year || !term) throw new Error('Existing test academic period required');
    admin = await prisma.user.create({ data: { email: tag + '@smartlab.local', passwordHash: await bcrypt.hash('ConcurrencyTest123!', 10), firstName: 'Inventory', lastName: 'Test', role: 'ADMIN' } });
    token = await loginAs(admin.email, 'ConcurrencyTest123!');
  });
  afterAll(async () => {
    if (!prisma) return;
    try {
      if (admin) {
        await prisma.notification.deleteMany({ where: { userId: admin.id } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: admin.id } });
      }
      await prisma.borrowRequest.deleteMany({ where: { id: { in: requests } } });
      await prisma.equipment.deleteMany({ where: { id: { in: equipment } } });
      if (admin) await prisma.user.delete({ where: { id: admin.id } });
    } finally { await prisma.$disconnect(); }
  });
  async function item(available=1, borrowed=0) {
    const e = await prisma.equipment.create({ data: { name:tag+'-'+require('node:crypto').randomUUID(), totalQuantity: available+borrowed, availableQuantity: available, borrowedQuantity: borrowed } });
    equipment.push(e.id); return e;
  }
  async function request(items, status='APPROVED') {
    const r = await prisma.borrowRequest.create({ data: { requestedBy: admin.id, academicYearId: year.id, termId: term.id, dateNeeded: new Date('2035-06-12T00:00:00Z'), status, items: { create: items.map(e => ({ equipmentId: e.id, quantity: 1 })) } } });
    requests.push(r.id); return r;
  }
  const act=(r,action)=>apiRequest('PATCH', '/borrow-requests/'+r.id+'/'+action, null, token);
  const stock=e=>prisma.equipment.findUnique({ where: { id: e.id } });
  const status=r=>prisma.borrowRequest.findUnique({ where: { id: r.id } });
  function oneWinner(results) {
    expect(results.filter(r=>r.status===200)).toHaveLength(1);
    expect(results.every(r=>[200,400,409].includes(r.status))).toBe(true);
  }
  test('simultaneous duplicate borrow moves stock once, replay is harmless', async () => {
    const e=await item(), r=await request([e]);
    oneWinner(await Promise.all(Array.from({length:6},()=>act(r,'borrow'))));
    expect((await act(r,'borrow')).status).toBe(409);
    expect(await stock(e)).toMatchObject({availableQuantity:0,borrowedQuantity:1});
    expect((await status(r)).status).toBe('BORROWED');
  });
  test('simultaneous duplicate return restores stock once', async () => {
    const e=await item(0,1), r=await request([e],'BORROWED');
    oneWinner(await Promise.all(Array.from({length:6},()=>act(r,'return'))));
    expect((await act(r,'return')).status).toBe(409);
    expect(await stock(e)).toMatchObject({availableQuantity:1,borrowedQuantity:0});
  });
  test.each([1,2,3])('return versus cancellation round %s restores stock once', async () => {
    const e=await item(0,1), r=await request([e],'BORROWED');
    oneWinner(await Promise.all([act(r,'return'),act(r,'cancel')]));
    expect(await stock(e)).toMatchObject({availableQuantity:1,borrowedQuantity:0});
    expect(['RETURNED','CANCELLED']).toContain((await status(r)).status);
  });
  test.each([1,2,3])('two requests competing for last unit round %s', async () => {
    const e=await item(), a=await request([e]), b=await request([e]);
    oneWinner(await Promise.all([act(a,'borrow'),act(b,'borrow')]));
    expect(await stock(e)).toMatchObject({availableQuantity:0,borrowedQuantity:1});
    expect([(await status(a)).status,(await status(b)).status].sort()).toEqual(['APPROVED','BORROWED']);
  });
  test('opposite item ordering cannot partially borrow competing requests', async () => {
    const a=await item(), b=await item(), x=await request([a,b]), y=await request([b,a]);
    oneWinner(await Promise.all([act(x,'borrow'),act(y,'borrow')]));
    for(const e of [a,b]) expect(await stock(e)).toMatchObject({availableQuantity:0,borrowedQuantity:1});
  });
  test('insufficient second item rolls back request and first item', async () => {
    const items=[await item(),await item()]; items.sort((a,b)=>a.id.localeCompare(b.id));
    await prisma.equipment.update({where:{id:items[1].id},data:{availableQuantity:0,borrowedQuantity:1}});
    const r=await request(items);
    expect((await act(r,'borrow')).status).toBe(409);
    expect((await status(r)).status).toBe('APPROVED');
    expect(await stock(items[0])).toMatchObject({availableQuantity:1,borrowedQuantity:0});
  });
  test('missing borrowed stock rolls return back', async () => {
    const e=await item(),r=await request([e],'BORROWED');
    expect((await act(r,'return')).status).toBe(409);
    expect((await status(r)).status).toBe('BORROWED');
    expect(await stock(e)).toMatchObject({availableQuantity:1,borrowedQuantity:0});
  });
  test('database rejects negative counters and mismatched totals', async () => {
    const e=await item();
    await expect(prisma.equipment.update({where:{id:e.id},data:{availableQuantity:-1,borrowedQuantity:2}})).rejects.toThrow();
    await expect(prisma.equipment.update({where:{id:e.id},data:{totalQuantity:2}})).rejects.toThrow();
    expect(await stock(e)).toMatchObject({totalQuantity:1,availableQuantity:1,borrowedQuantity:0});
  });
  test('borrow/return require authentication', async () => {
    const e=await item(), r=await request([e]);
    for(const action of ['borrow','return']) expect((await apiRequest('PATCH','/borrow-requests/'+r.id+'/'+action,null,null)).status).toBe(401);
    expect(await stock(e)).toMatchObject({availableQuantity:1,borrowedQuantity:0});
  });
  test('simultaneous approvals cannot reset a completed borrow', async () => {
    const e=await item(),r=await request([e],'PENDING');
    oneWinner(await Promise.all([act(r,'approve'),act(r,'approve')]));
    expect((await act(r,'borrow')).status).toBe(200);
    expect((await act(r,'approve')).status).not.toBe(200);
    expect((await status(r)).status).toBe('BORROWED');
    expect(await stock(e)).toMatchObject({availableQuantity:0,borrowedQuantity:1});
  });
  test('rejection competing with borrow cannot overwrite a borrowed request', async () => {
    const e=await item(),r=await request([e]);
    const results=await Promise.all([act(r,'borrow'),apiRequest('PATCH','/borrow-requests/'+r.id+'/reject',{reason:'Concurrency test'},token)]);
    oneWinner(results);
    const current=await status(r);
    expect(['BORROWED','REJECTED']).toContain(current.status);
    expect(await stock(e)).toMatchObject(current.status==='BORROWED'?{availableQuantity:0,borrowedQuantity:1}:{availableQuantity:1,borrowedQuantity:0});
  });

});
