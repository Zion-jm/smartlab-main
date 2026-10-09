import type { BorrowRequest } from '../../../types/requests';

type Entry = { key: string; label: string };
export type DemandHighlight = { title: string; leaders: string[]; count: number };

export function buildDemandHighlights(requests: BorrowRequest[]): DemandHighlight[] {
  const section = (r: BorrowRequest): Entry[] => r.programId && r.yearLevel != null
    ? [{ key: r.programId + ':' + r.yearLevel, label: [r.programCode || r.program || 'Unknown program', r.yearLevel].join(' - ') }] : [];
  const hasEquipment = (r: BorrowRequest) => (r.items ?? []).some(item => item.quantity > 0);
  const rank = (title: string, entries: (r: BorrowRequest) => Entry[]): DemandHighlight => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const request of requests) {
      // An item counts once per request, regardless of quantity or duplicate lines.
      for (const entry of new Map(entries(request).map(entry => [entry.key, entry])).values()) {
        const current = counts.get(entry.key) ?? { label: entry.label, count: 0 };
        current.count += 1;
        counts.set(entry.key, current);
      }
    }
    const count = Math.max(0, ...Array.from(counts.values(), value => value.count));
    return { title, count, leaders: Array.from(counts.values()).filter(value => value.count === count).map(value => value.label).sort() };
  };
  return [
    rank('Most requested computer lab', r => r.roomId && r.isComputerLab === true ? [{ key: r.roomId, label: r.location || 'Unnamed computer lab' }] : []),
    rank('Top section · computer lab requests', r => r.roomId && r.isComputerLab === true ? section(r) : []),
    rank('Top section · equipment requests', r => hasEquipment(r) ? section(r) : []),
    rank('Top faculty in charge', r => r.facultyId && (r.roomId || hasEquipment(r)) ? [{ key: r.facultyId, label: r.facultyName || 'Unnamed faculty' }] : []),
    rank('Most requested equipment', r => (r.items ?? []).filter(item => item.quantity > 0).map(item => ({ key: item.equipmentId, label: item.equipmentName }))),
  ];
}
