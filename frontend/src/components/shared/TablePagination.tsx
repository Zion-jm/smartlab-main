import { useContext } from 'react';
import { TablePanelContext } from './tableScrollContext';
import { TABLE_PAGE_SIZE_OPTIONS } from './tablePaginationConstants';

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalAvailableItems?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
}

export default function TablePagination({
  currentPage,
  pageSize,
  totalItems,
  totalAvailableItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
}: TablePaginationProps) {
  const isTableActive = useContext(TablePanelContext);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const firstItem = (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  if (totalItems <= 0) return null;

  const paginationPositionClass = isTableActive
    ? 'sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(17,24,39,0.08)]'
    : 'relative';

  return (
    <div
      data-table-pagination="true"
      className={`${paginationPositionClass} flex flex-col gap-3 border-t border-[#e5e7eb] bg-white px-3 py-3 text-xs text-[#6b7280] sm:flex-row sm:items-center sm:justify-between`}
    >
      <p aria-live="polite" className="whitespace-nowrap">
        Showing <span className="font-semibold text-[#374151]">{firstItem}–{lastItem}</span> of{' '}
        <span className="font-semibold text-[#374151]">{totalItems}</span>
        {totalAvailableItems !== undefined && totalAvailableItems !== totalItems && (
          <span> ({totalAvailableItems} total)</span>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <label className="flex items-center gap-2 whitespace-nowrap">
          <span className="hidden sm:inline">Rows per page</span>
          <span className="sm:hidden">Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Rows per page"
            className="rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5 text-xs font-semibold text-[#374151] focus:border-[#800000] focus:outline-none focus:ring-2 focus:ring-[#800000]/20"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            className="rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 font-semibold text-[#374151] transition hover:border-[#800000] hover:text-[#800000] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="First page"
          >
            <span className="hidden sm:inline">First</span>
            <span className="sm:hidden">«</span>
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 font-semibold text-[#374151] transition hover:border-[#800000] hover:text-[#800000] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>
          <label className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-[#374151]">
            <span className="hidden sm:inline">Page</span>
            <select
              value={safePage}
              onChange={(event) => onPageChange(Number(event.target.value))}
              aria-label="Select page"
              className="rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5 font-semibold text-[#374151] focus:border-[#800000] focus:outline-none focus:ring-2 focus:ring-[#800000]/20"
            >
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>
            <span>of {totalPages}</span>
          </label>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 font-semibold text-[#374151] transition hover:border-[#800000] hover:text-[#800000] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 font-semibold text-[#374151] transition hover:border-[#800000] hover:text-[#800000] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Last page"
          >
            <span className="hidden sm:inline">Last</span>
            <span className="sm:hidden">»</span>
          </button>
        </div>
      </div>
    </div>
  );
}