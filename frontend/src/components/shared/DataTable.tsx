import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { TablePanelContext, TableScrollContext } from './tableScrollContext';
import TablePagination, { type TablePaginationProps } from './TablePagination';

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  action?: boolean;
};
export type DataTableProps<T> = {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  rowKey: (row: T) => string;
  label: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  density?: 'compact' | 'comfortable';
  minWidth?: number;
  pagination?: TablePaginationProps;
  rowTestId?: (row: T) => string;
};

export function TablePanel({ children, label }: { children: ReactNode; label: string }) {
  return <section aria-label={label} className="data-table-panel rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">{children}</section>;
}

/** Controlled screen table. The caller owns fetching, filtering and mutations. */
export default function DataTable<T>({
  rows, columns, rowKey, label, loading = false, error, onRetry,
  emptyMessage = 'No records match the selected filters.',
  density = 'comfortable', minWidth = 760, pagination, rowTestId,
}: DataTableProps<T>) {
  const { root, inset } = useContext(TableScrollContext);
  const table = useRef<HTMLTableElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ active: false, width: 0, widths: [] as number[] });
  const hasRows = !loading && !error && rows.length > 0;

  useEffect(() => {
    if (!hasRows || !table.current || !viewport.current) return;
    const element = table.current;
    const view = viewport.current;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const top = (root?.getBoundingClientRect().top ?? 0) + inset;
      const head = element.tHead;
      setLayout({
        active: bounds.top < top && bounds.bottom > top + (head?.offsetHeight ?? 0),
        width: element.offsetWidth,
        widths: head ? Array.from(head.rows[0].cells, cell => cell.getBoundingClientRect().width) : [],
      });
      if (mirror.current) mirror.current.scrollLeft = view.scrollLeft;
    };
    // The portal provides its vertical root; standalone tables use window scroll.
    const scrollTarget = root ?? window;
    scrollTarget.addEventListener('scroll', update, { passive: true });
    view.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (root) observer.observe(root);
    const frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scrollTarget.removeEventListener('scroll', update);
      view.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [hasRows, root, inset, rows, columns]);

  useEffect(() => {
    if (pagination && !loading && !error) {
      const last = Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize));
      if (pagination.currentPage > last) pagination.onPageChange(last);
    }
  }, [pagination, loading, error]);

  const headers = (mirrored = false) => (
    <thead><tr>{columns.map((column, index) => (
      <th key={column.id} scope="col" style={{
        textAlign: column.align ?? (column.action ? 'right' : 'left'),
        width: mirrored ? layout.widths[index] : column.width,
      }}>{column.header}</th>
    ))}</tr></thead>
  );

  return (
    <TablePanel label={label}>
      <TablePanelContext.Provider value={hasRows && layout.active}>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? <p className="data-table-state" role="status">Loading {label.toLowerCase()}…</p>
            : error ? <div className="data-table-state" role="alert">
              <p>{error}</p>
              {onRetry && <button type="button" onClick={onRetry} className="min-h-10 px-3 text-[#800000] underline">Retry</button>}
            </div>
            : !rows.length ? <p className="data-table-state">{emptyMessage}</p> : null}
        </div>
        {hasRows && <>
          {/* A visual-only header outside overflow-x keeps page-level stickiness.
              The semantic table below remains the accessible source of truth. */}
          <div className="data-table-sticky-head" style={{ top: inset }} aria-hidden="true" inert>
            <div ref={mirror} className="data-table-header-mirror" style={{ visibility: layout.active ? 'visible' : 'hidden' }}>
              <table className={'data-table data-table--' + density} style={{ width: layout.width, tableLayout: 'fixed' }}>{headers(true)}</table>
            </div>
          </div>
          <div ref={viewport} role="region" aria-label={label + ' table, scroll horizontally'} tabIndex={0} className="data-table-viewport">
            <table ref={table} className={'data-table data-table--' + density} style={{ minWidth }}>
              <caption className="sr-only">{label}</caption>
              {headers()}
              <tbody>{rows.map(row => (
                <tr key={rowKey(row)} data-testid={rowTestId?.(row)}>
                  {columns.map(column => <td key={column.id} style={{ textAlign: column.align ?? (column.action ? 'right' : 'left') }}>
                    {column.action ? <div className="data-table-actions">{column.cell(row)}</div> : column.cell(row)}
                  </td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}
        {pagination && !loading && !error && <TablePagination {...pagination} />}
      </TablePanelContext.Provider>
    </TablePanel>
  );
}
