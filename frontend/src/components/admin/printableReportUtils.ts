import { academicPeriodApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import type { PrintableReportDefinition } from './PrintableReportDocument';

const getColumnValue = <T,>(row: T, column: PrintableReportDefinition<T>['columns'][number]) => {
  if (column.formatCsv) return column.formatCsv(row);
  if (typeof column.key === 'string') return (row as Record<string, unknown>)[column.key];
  return row[column.key];
};

const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};

export function reportDefinitionToCsv<T>(definition: PrintableReportDefinition<T>, metadata: unknown[][] = []) {
  const headers = definition.columns.map((column) => column.label);
  const rows = definition.rows.map((row) =>
    definition.columns.map((column) => getColumnValue(row, column))
  );
  return [...metadata, ...(metadata.length ? [[]] : []), headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadPrintableReport<T>(definition: PrintableReportDefinition<T>) {
  const url = URL.createObjectURL(
    new Blob([reportDefinitionToCsv(definition)], { type: 'text/csv;charset=utf-8' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = definition.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
export async function downloadReportSpreadsheet<T>(definition: PrintableReportDefinition<T>, options: {
  academicPeriod: { academicYearId: string; termId: string };
  range: { from: string; to: string };
  filters: string[];
}) {
  try {
    const { data } = await academicPeriodApi.get();
    const year = data.academicYears?.find((item: { id: string }) => item.id === options.academicPeriod.academicYearId)?.year;
    const term = data.terms?.find((item: { id: string }) => item.id === options.academicPeriod.termId)?.name;
    const metadata = [
      ['SmartLab', definition.title],
      ['Academic year', year || 'All academic years'], ['Term', term || 'All terms'],
      ['From', options.range.from || 'No start limit'], ['To', options.range.to || 'No end limit'],
      ['Scope', 'Current filtered report — all matching rows'],
      ['Filters', options.filters.join('; ') || 'None'],
      ['Generated (Asia/Manila)', new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })],
      ['Records', definition.rows.length],
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF', reportDefinitionToCsv(definition, metadata)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = definition.filename.replace(/\.csv$/i, '') + '.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast.error('Could not prepare the spreadsheet. Please try again.');
  }
}
