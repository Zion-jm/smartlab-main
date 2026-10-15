import { Prisma } from '@prisma/client';
import { DomainError } from './domainError';
import { manilaDayBounds, manilaMinutes, formatManilaDate, formatManilaTime } from '../utils/manilaTime';

type Window = { dateNeeded: Date; timeStart: Date | null; timeEnd: Date | null };
export function checkoutWindow(request: Window) {
  const day = manilaDayBounds(request.dateNeeded).start.getTime();
  if (!request.timeStart || !request.timeEnd) throw new DomainError(409, 'Correct the reservation time before recording checkout.');
  const start = new Date(day + manilaMinutes(request.timeStart) * 60000);
  const end = new Date(day + manilaMinutes(request.timeEnd) * 60000);
  if (end <= start) throw new DomainError(409, 'Correct the reservation time before recording checkout.');
  return { start, end };
}
export function validateCheckoutReason(request: Window, reason: unknown, now: Date) {
  const { start, end } = checkoutWindow(request);
  const outside = now < start || now >= end;
  if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 500)) throw new DomainError(400, 'Checkout reason must be text of at most 500 characters.');
  if (outside && !(typeof reason === 'string' && reason.trim())) throw new DomainError(409,
    'Outside the scheduled period (' + formatManilaDate(start) + ', ' + formatManilaTime(start) + '–' + formatManilaTime(end) + '). Enter a reason to record early collection or a missed checkout. The return deadline will not change.', 'CHECKOUT_REASON_REQUIRED');
}
// Physical stock is checked separately. Protect reservations over every day of an early checkout.
export async function assertCheckoutReservations(tx: Prisma.TransactionClient, request: Window & {id:string;items:{equipmentId:string;quantity:number}[]}, now: Date) {
  const { end } = checkoutWindow(request);
  if (now >= end) return; // Late recording has no remaining scheduled window; physical reconciliation still applies.
  const reservations = await tx.borrowRequest.findMany({where:{id:{not:request.id},status:'APPROVED',dateNeeded:{gte:manilaDayBounds(now).start,lte:manilaDayBounds(end).start}},include:{items:true}});
  for (const item of request.items) {
    const stock = await tx.equipment.findUnique({where:{id:item.equipmentId}});
    const events: [number,number][]=[];
    for(const reservation of reservations){
      const window=checkoutWindow(reservation);
      const from=Math.max(now.getTime(),window.start.getTime()),to=Math.min(end.getTime(),window.end.getTime());
      if(from>=to)continue;
      for(const line of reservation.items.filter(line=>line.equipmentId===item.equipmentId))events.push([from,line.quantity],[to,-line.quantity]);
    }
    events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    let peak=0,used=0;for(const [,delta] of events){used+=delta;peak=Math.max(peak,used);}
    if(!stock || stock.availableQuantity-item.quantity<peak) throw new DomainError(409,'Checkout would use equipment reserved for another request. Review availability before handing it over.');
  }
}
