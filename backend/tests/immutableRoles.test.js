const mockPrisma = { user: { findUnique: jest.fn() }, $transaction: jest.fn() };
jest.mock('../dist/db/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../dist/middleware/auth', () => ({ authenticateToken: (_req,_res,next)=>next(), authorizeRoles: ()=> (_req,_res,next)=>next() }));
jest.mock('../dist/services/accountReactivationService', () => ({ accountStatusChanged: jest.fn() }));
jest.mock('../dist/services/auditLogService', () => ({ recordRequiredAuditLog: jest.fn() }));
const router = require('../dist/routes/users').default;
const route = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.put).route;
const handler = route.stack[route.stack.length - 1].handle;
let user, tx, response;
beforeEach(()=>{
 jest.clearAllMocks();
 user={id:'faculty',email:'faculty@example.test',firstName:'Test',lastName:'Faculty',phone:null,role:'FACULTY',status:'ACTIVE',sessionVersion:0,updatedAt:new Date(),facultyProfile:{id:'profile',departmentId:'department',department:{id:'department',name:'Science'}},studentProfile:null};
 mockPrisma.user.findUnique.mockResolvedValue(user);
 tx={user:{update:jest.fn().mockResolvedValue(user),findUniqueOrThrow:jest.fn().mockResolvedValue(user)},facultyProfile:{upsert:jest.fn()},studentProfile:{deleteMany:jest.fn()},adminProfile:{deleteMany:jest.fn()},labSchedule:{deleteMany:jest.fn()},borrowRequest:{updateMany:jest.fn()}};
 mockPrisma.$transaction.mockImplementation(work=>work(tx));
 response={status:jest.fn().mockReturnThis(),json:jest.fn(),setHeader:jest.fn()};
});
test.each([{role_id:1},{roleId:3},{role:'STUDENT'},{role_id:2,role:'ADMIN'},{role_id:2,roleId:1}])('rejects role mutation %j before modifying any linked data',async body=>{
 await handler({params:{id:user.id},user:{id:'admin',role:'ADMIN'},body},response);
 expect(response.status).toHaveBeenCalledWith(400);
 expect(response.json).toHaveBeenCalledWith(expect.objectContaining({error:'Account roles cannot be changed after creation.'}));
 expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});
test.each([{}, {role_id:2},{roleId:'2'},{role:'FACULTY'},{role_id:2,roleId:2,role:'faculty'}])('accepts ordinary edit with unchanged role %j and preserves profiles',async body=>{
 await handler({params:{id:user.id},user:{id:'admin',role:'ADMIN'},body:{...body,first_name:'Updated'}},response);
 expect(response.status).not.toHaveBeenCalled();
 expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({firstName:'Updated'})}));
 expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty('role');
 expect(tx.studentProfile.deleteMany).not.toHaveBeenCalled();
 expect(tx.adminProfile.deleteMany).not.toHaveBeenCalled();
 expect(tx.labSchedule.deleteMany).not.toHaveBeenCalled();
 expect(tx.borrowRequest.updateMany).not.toHaveBeenCalled();
});
test.each([{role_id:null},{roleId:99},{role:false},{role:'unknown'}])('rejects invalid role %j',async body=>{
 await handler({params:{id:user.id},user:{id:'admin',role:'ADMIN'},body},response);
 expect(response.status).toHaveBeenCalledWith(400);
 expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});
test('self-service cannot change role either',async()=>{
 await handler({params:{id:user.id},user:{id:user.id,role:'FACULTY'},body:{role:'ADMIN'}},response);
 expect(response.status).toHaveBeenCalledWith(400);
 expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});

test.each(['put','patch','post','delete'])('%s account endpoint rejects administrator self-deactivation before writes',async method=>{
 const path=method==='put'||method==='delete'?'/:id':method==='patch'?'/:id/status':'/:id/retire';
 const selected=router.stack.find(layer=>layer.route?.path===path && layer.route.methods[method]).route;
 const action=selected.stack[selected.stack.length-1].handle;
 user.role='ADMIN';
 await action({params:{id:user.id},user:{id:user.id,role:'ADMIN'},body:{status:'DEACTIVATED'}},response);
 expect(response.status).toHaveBeenCalledWith(409);
 expect(tx.user.update).not.toHaveBeenCalled();
});
