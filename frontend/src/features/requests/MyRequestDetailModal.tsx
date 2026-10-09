import { useState } from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import TableCellDetailModal from '../../components/shared/TableCellDetailModal';
import type { RequestRow } from './requestModels';

export default function MyRequestDetailModal({ request, onClose, onReview, requester }: { request: RequestRow; onClose: () => void; onReview?: () => void; requester?: string }) {
  const [expanded, setExpanded] = useState(false);
  const source = request.source;
  const items = source.items ?? [];
  const status = request.status === 'REJECTED' ? 'Declined' : request.status.charAt(0) + request.status.slice(1).toLowerCase();
  const section = [source.program?.code || source.program?.name, source.yearLevel].filter(value => value != null && value !== '').join(' - ');
  const faculty = [source.faculty?.user?.firstName, source.faculty?.user?.lastName].filter(Boolean).join(' ');
  return <TableCellDetailModal isOpen onClose={onClose} title={request.reference} data={source} fields={[]} subtitle={onReview ? 'Review the details before making a decision' : undefined} actions={onReview ? [{ label: request.status === 'PENDING' ? 'Review request' : 'Open request', onClick: onReview, variant: 'primary' }] : []}>
    <div className="space-y-5 text-sm text-[#514343]">
      {requester && <section className="rounded-xl bg-[#fff8f3] p-4"><p className="text-xs text-[#786565]">Requested by</p><p className="mt-1 font-semibold text-[#321d1d]">{requester}</p></section>}
      <section aria-label="Request summary"><p className="mb-2 text-xs font-semibold text-[#800000]">{source.requestType === 'EQUIPMENT' ? 'Equipment borrowing · intended usage location (not a room reservation)' : source.requestType === 'LABORATORY' ? 'Laboratory reservation' : source.requestType === 'LEGACY' ? 'Legacy request' : 'Request type unavailable'}</p>
        <span className="inline-flex rounded-full bg-[#f5eae5] px-3 py-1 text-xs font-semibold text-[#800000]">{status}</span>
        <h3 className="mt-4 flex items-start gap-2 text-lg font-semibold text-[#321d1d]"><MapPin size={20} className="mt-1 shrink-0 text-[#800000]" aria-hidden="true" />{request.room}</h3>
        <p className="mt-3 flex items-start gap-2"><CalendarDays size={17} className="shrink-0 text-[#9d6a4e]" aria-hidden="true" />{request.dateOfUse}</p>
        <p className="mt-2 flex items-start gap-2"><Clock size={17} className="shrink-0 text-[#9d6a4e]" aria-hidden="true" />{request.time}</p>
      </section>
      {source.rejectionNote && <section className="rounded-lg bg-red-50 p-3 text-red-800"><h3 className="font-semibold">Decline reason</h3><p className="mt-1 whitespace-pre-wrap break-words">{source.rejectionNote}</p></section>}
      <section className="border-t border-[#ead7d3] pt-4" aria-label="Requested equipment">
        <h3 className="font-semibold text-[#321d1d]">Equipment · {items.length} {items.length === 1 ? 'item' : 'items'}</h3>
        {items.length ? <ul className="mt-2 divide-y divide-[#f1e8e4]">{(expanded ? items : items.slice(0, 3)).map(item => <li key={item.id} className="flex items-start justify-between gap-4 py-2.5"><span className="min-w-0 break-words">{item.equipment?.name || 'Equipment item'}</span><span className="shrink-0 font-semibold text-[#800000]">×{item.quantity}</span></li>)}</ul> : <p className="mt-2 text-[#786565]">No equipment requested</p>}
        {items.length > 3 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#800000] hover:bg-[#fff0ed]">{expanded ? 'Show fewer items' : `Show all ${items.length} items`}</button>}
      </section>
      <section className="border-t border-[#ead7d3] pt-4">
        <h3 className="mb-3 font-semibold text-[#321d1d]">Class details</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="text-xs text-[#786565]">Subject</dt><dd className="mt-1 break-words">{source.subject?.name || source.subject?.code || 'Not specified'}</dd></div>
          <div><dt className="text-xs text-[#786565]">Section</dt><dd className="mt-1 break-words">{section || 'Not specified'}</dd></div>
          <div><dt className="text-xs text-[#786565]">Faculty</dt><dd className="mt-1 break-words">{faculty || 'Not assigned'}</dd></div>
        </dl>
      </section>
      <section className="border-t border-[#ead7d3] pt-4"><h3 className="font-semibold text-[#321d1d]">Purpose</h3><p className="mt-2 whitespace-pre-wrap break-words">{source.purpose || 'Not specified'}</p></section>
      {source.notes && source.notes !== source.rejectionNote && <section className="border-t border-[#ead7d3] pt-4"><h3 className="font-semibold text-[#321d1d]">Admin notes</h3><p className="mt-2 whitespace-pre-wrap break-words">{source.notes}</p></section>}
      <dl className="grid gap-3 border-t border-[#ead7d3] pt-4 text-xs text-[#786565] sm:grid-cols-2"><div><dt>Filed</dt><dd className="mt-1">{request.filed}</dd></div><div><dt>Contact details</dt><dd className="mt-1 break-words">{source.contactDetails || 'Not provided'}</dd></div></dl>
    </div>
  </TableCellDetailModal>;
}
