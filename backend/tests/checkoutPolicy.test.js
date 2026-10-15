const {validateCheckoutReason,assertCheckoutReservations}=require('../dist/services/checkoutPolicy');
const {changeLoanStatus}=require('../dist/services/inventoryMovementService');
const {cancelBorrowRequest}=require('../dist/services/cancelBorrowRequestService');
const date=t=>new Date('2030-10-15T'+t+':00+08:00');
const request={id:'r',dateNeeded:date('00:00'),timeStart:date('10:00'),timeEnd:date('12:00'),status:'APPROVED',requestType:'EQUIPMENT',items:[{equipmentId:'e',quantity:1}]};
test.each(['09:00','12:00','13:00'])('requires a reason at %s',time=>{expect(()=>validateCheckoutReason(request,undefined,date(time))).toThrow('Outside the scheduled');expect(()=>validateCheckoutReason(request,'Already collected; recording late',date(time))).not.toThrow();});
test.each(['10:00','11:59'])('normal checkout at %s requires no reason',time=>expect(()=>validateCheckoutReason(request,undefined,date(time))).not.toThrow());
test.each([' ', 'x'.repeat(501),42])('rejects invalid reason %s',reason=>expect(()=>validateCheckoutReason(request,reason,date('09:00'))).toThrow());
function capacity(reservations,available=1){return {borrowRequest:{findMany:jest.fn().mockResolvedValue(reservations)},equipment:{findUnique:jest.fn().mockResolvedValue({availableQuantity:available})}};}
test('early checkout protects an earlier reservation',async()=>{const tx=capacity([{...request,id:'other',timeStart:date('09:00'),timeEnd:date('10:00')}]);await expect(assertCheckoutReservations(tx,request,date('09:30'))).rejects.toThrow('reserved');});
test('adjacent reservation does not conflict at checkout start',async()=>{await expect(assertCheckoutReservations(capacity([{...request,id:'other',timeStart:date('09:00'),timeEnd:date('10:00')}]),request,date('10:00'))).resolves.toBeUndefined();});
test('late record still rejects insufficient physical stock without marking borrowed',async()=>{
 const tx={borrowRequest:{findUnique:jest.fn().mockResolvedValue(request),updateMany:jest.fn().mockResolvedValue({count:1})},equipment:{updateMany:jest.fn().mockResolvedValue({count:0})}};
 await expect(changeLoanStatus(tx,'r','borrow',{reason:'Missed checkout',now:date('13:00')})).rejects.toThrow('Not enough');
 // Caller owns the serializable transaction and rolls back the claimed status on failure.
});
test('reason warning happens before writes',async()=>{const tx={borrowRequest:{findUnique:jest.fn().mockResolvedValue(request),updateMany:jest.fn()}};await expect(changeLoanStatus(tx,'r','borrow',{now:date('09:00')})).rejects.toMatchObject({code:'CHECKOUT_REASON_REQUIRED'});expect(tx.borrowRequest.updateMany).not.toHaveBeenCalled();});
test('borrowed cancellation does not touch inventory or schedules',async()=>{const tx={borrowRequest:{findUnique:jest.fn().mockResolvedValue({...request,status:'BORROWED'}),updateMany:jest.fn()}};await expect(cancelBorrowRequest(tx,{id:'r',actorId:'admin',actorRole:'ADMIN'})).rejects.toThrow('returned, not cancelled');expect(tx.borrowRequest.updateMany).not.toHaveBeenCalled();});

test.each(['11:00','13:00'])('successful checkout at %s records once and preserves deadline',async time=>{
 const now=date(time),saved={...request,status:'BORROWED',borrowedAt:now};
 const tx={borrowRequest:{findUnique:jest.fn().mockResolvedValue(request),findMany:jest.fn().mockResolvedValue([]),updateMany:jest.fn().mockResolvedValue({count:1}),findUniqueOrThrow:jest.fn().mockResolvedValue(saved)},equipment:{findUnique:jest.fn().mockResolvedValue({availableQuantity:1}),updateMany:jest.fn().mockResolvedValue({count:1}),findUniqueOrThrow:jest.fn().mockResolvedValue({id:'e',availableQuantity:0,borrowedQuantity:1,damagedQuantity:0,totalQuantity:1}),update:jest.fn()}};
 await changeLoanStatus(tx,'r','borrow',{now,reason:time==='13:00'?'Missed checkout':undefined});
 expect(tx.borrowRequest.updateMany.mock.calls[0][0].data).toEqual({status:'BORROWED',borrowedAt:now});
 tx.borrowRequest.findUnique.mockResolvedValue(saved);
 await expect(changeLoanStatus(tx,'r','borrow',{now,reason:'Retry'})).rejects.toThrow('already completed');
 expect(tx.equipment.updateMany).toHaveBeenCalledTimes(1);
});
test('return remains possible outside the reservation period without checkout reason',async()=>{
 const tx={borrowRequest:{findUnique:jest.fn().mockResolvedValue({...request,status:'BORROWED'}),updateMany:jest.fn().mockResolvedValue({count:1}),findUniqueOrThrow:jest.fn()},equipment:{updateMany:jest.fn().mockResolvedValue({count:1}),findUniqueOrThrow:jest.fn().mockResolvedValue({id:'e',availableQuantity:1,borrowedQuantity:0,damagedQuantity:0,totalQuantity:1}),update:jest.fn()}};
 await expect(changeLoanStatus(tx,'r','return',{now:date('13:00')})).resolves.toBeUndefined();
 expect(tx.equipment.updateMany.mock.calls[0][0].data).toEqual({availableQuantity:{increment:1},borrowedQuantity:{decrement:1}});
});
