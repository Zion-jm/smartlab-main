import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RequestActionError } from './requestActionError';
import { borrowRequestInclude } from './borrowRequestService';
import { effectiveStatus } from './equipmentLifecycle';
import { recordRequiredAuditLog } from './auditLogService';

export async function recordEquipmentReturn(tx: Prisma.TransactionClient, id: string, actorId: string, input: {submissionId?:unknown;expectedUpdatedAt?:unknown;items?:unknown;notes?:unknown} = {}) {
  const detailed = input.items !== undefined;
  if (detailed && (typeof input.submissionId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.submissionId))) throw new RequestActionError(400,'A valid return submission ID is required.');
  const submissionId = detailed ? input.submissionId as string : randomUUID();
  if (await tx.equipmentReturn.findUnique({where:{submissionId}})) throw new RequestActionError(409,'This return was already recorded. Refresh the request.');
  const request=await tx.borrowRequest.findUnique({where:{id},include:{items:{include:{equipment:true}}}});
  if(!request)throw new RequestActionError(404,'Request not found.');
  if(request.status!=='BORROWED' || !request.items.length)throw new RequestActionError(409,'Only outstanding borrowed equipment can be returned.');
  if(detailed && input.expectedUpdatedAt!==request.updatedAt.toISOString())throw new RequestActionError(409,'The request changed. Refresh before recording a return.');
  if(!detailed && request.items.some(i=>i.returnedGood+i.returnedDamaged>0))throw new RequestActionError(409,'Open the return form to record the remaining quantities.');
  if(input.notes!==undefined && (typeof input.notes!=='string' || input.notes.length>1000))throw new RequestActionError(400,'Return notes must be text of at most 1000 characters.');
  const notes=typeof input.notes==='string'?input.notes.trim():'';
  const raw=detailed?input.items:request.items.map(i=>({itemId:i.id,good:i.quantity,damaged:0}));
  if(!Array.isArray(raw) || raw.length!==request.items.length)throw new RequestActionError(400,'Include each requested equipment item once.');
  const seen=new Set<string>();
  const lines=raw.map(line=>{
    const item=request.items.find(i=>i.id===line?.itemId);
    if(!item||seen.has(item.id)||!Number.isInteger(line.good)||!Number.isInteger(line.damaged)||line.good<0||line.damaged<0)throw new RequestActionError(400,'Enter valid whole-number quantities for each item once.');
    seen.add(item.id);
    const outstanding=item.quantity-item.returnedGood-item.returnedDamaged;
    if(line.good+line.damaged>outstanding)throw new RequestActionError(409,'Returned quantities exceed outstanding equipment. Refresh and check the quantities.');
    return {itemId:item.id,equipmentId:item.equipmentId,equipmentName:item.equipment.name,good:line.good as number,damaged:line.damaged as number,outstandingAfter:outstanding-line.good-line.damaged};
  });
  if(!lines.some(l=>l.good+l.damaged>0))throw new RequestActionError(400,'Record at least one returned unit.');
  if(lines.some(l=>l.damaged>0)&&!notes)throw new RequestActionError(400,'Notes are required for damaged returns.');
  const complete=lines.every(l=>l.outstandingAfter===0),now=new Date();
  const claimed=await tx.borrowRequest.updateMany({where:{id,status:'BORROWED',updatedAt:request.updatedAt},data:{status:complete?'RETURNED':'BORROWED',returnedAt:complete?now:null,updatedAt:now}});
  if(claimed.count!==1)throw new RequestActionError(409,'This request changed. Refresh before recording a return.');
  for(const line of [...lines].sort((a,b)=>a.equipmentId.localeCompare(b.equipmentId))){
    if(!line.good&&!line.damaged)continue;
    const changed=await tx.equipment.updateMany({where:{id:line.equipmentId,borrowedQuantity:{gte:line.good+line.damaged}},data:{borrowedQuantity:{decrement:line.good+line.damaged},availableQuantity:{increment:line.good},damagedQuantity:{increment:line.damaged}}});
    if(changed.count!==1)throw new RequestActionError(409,'Inventory does not match this loan. Inventory review is required.');
    const stock=await tx.equipment.findUniqueOrThrow({where:{id:line.equipmentId}});
    await tx.equipment.update({where:{id:stock.id},data:{status:effectiveStatus(stock)}});
    await tx.borrowRequestItem.update({where:{id:line.itemId},data:{returnedGood:{increment:line.good},returnedDamaged:{increment:line.damaged}}});
  }
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId},select:{firstName:true,lastName:true}});
  const event=await tx.equipmentReturn.create({data:{submissionId,borrowRequestId:id,actorId,actorName:[actor.firstName,actor.lastName].join(' ').trim(),notes,lines:lines as Prisma.InputJsonValue,createdAt:now}});
  await recordRequiredAuditLog(tx,{actorUserId:actorId,action:'RETURN',entityType:'BorrowRequest',entityId:id,details:{returnId:event.id,complete,notes,lines}});
  return tx.borrowRequest.findUniqueOrThrow({where:{id},include:borrowRequestInclude});
}
