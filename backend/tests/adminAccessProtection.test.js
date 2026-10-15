const {assertAccountDeactivationAllowed: check}=require('../dist/services/adminAccessProtection');
const admin={id:'admin',role:'ADMIN',status:'ACTIVE'};
function client(target,remaining=1,actor=admin){return {user:{findUnique:jest.fn(({where})=>Promise.resolve(where.id==='admin'?actor:target)),count:jest.fn().mockResolvedValue(remaining)}};}
test('rejects self-deactivation',async()=>{const tx=client(admin);await expect(check(tx,'admin','admin','DEACTIVATED')).rejects.toThrow('Ask another administrator');expect(tx.user.findUnique).not.toHaveBeenCalled();});
test('rejects removing the last active administrator',async()=>{await expect(check(client({...admin,id:'target'},0),'target','admin','DEACTIVATED')).rejects.toThrow('At least one active');});
test('allows deactivating another administrator when a replacement remains',async()=>{await expect(check(client({...admin,id:'target'}),'target','admin','DEACTIVATED')).resolves.toBeUndefined();});
test('rejects an actor deactivated by a concurrent request',async()=>{await expect(check(client({...admin,id:'target'},1,{...admin,status:'DEACTIVATED'}),'target','admin','DEACTIVATED')).rejects.toThrow('active administrator');});
test('permits ordinary student deactivation',async()=>{const tx=client({id:'target',role:'STUDENT',status:'ACTIVE'});await check(tx,'target','admin','DEACTIVATED');expect(tx.user.count).not.toHaveBeenCalled();});
test('does not interfere with activation or ordinary active-account edits',async()=>{const tx=client(admin);await check(tx,'admin','admin','ACTIVE');expect(tx.user.findUnique).not.toHaveBeenCalled();});
