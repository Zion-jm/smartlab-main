import type { PrintableReportDefinition } from './PrintableReportDocument';

const getColumnValue = <T,>(row: T, column: PrintableReportDefinition<T>['columns'][number]) => {
  if (column.formatCsv) return column.formatCsv(row);
  if (typeof column.key === 'string') return (row as Record<string, unknown>)[column.key];
  return row[column.key];
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function reportDefinitionToCsv<T>(definition: PrintableReportDefinition<T>) {
  const headers = definition.columns.map((column) => column.label);
  const rows = definition.rows.map((row) =>
    definition.columns.map((column) => getColumnValue(row, column))
  );
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
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