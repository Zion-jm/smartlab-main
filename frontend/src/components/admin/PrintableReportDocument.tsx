import { academicPeriodApi } from '../../services/api';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './reportDocumentStyles.css';

export type PrintableReportColumn<T> = {
  key: keyof T | string;
  label: string;
  width?: string;
  render?: (row: T) => ReactNode;
  formatCsv?: (row: T) => unknown;
};

export type PrintableReportDefinition<T> = {
  title: string;
  context?: string;
  columns: PrintableReportColumn<T>[];
  rows: T[];
  filename: string;
};

function getColumnValue<T>(row: T, column: PrintableReportColumn<T>) {
  if (column.formatCsv) return column.formatCsv(row);
  if (typeof column.key === 'string') return (row as Record<string, unknown>)[column.key];
  return row[column.key];
}

type ReportDocumentHeaderProps = {
  pageNumber: number;
  totalPages: number;
};

export function ReportDocumentHeader({ pageNumber, totalPages }: ReportDocumentHeaderProps) {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="report-document-header">
      <div className="report-document-logo-frame">
        <img
          src="/PUPLogo.png"
          alt="Polytechnic University of the Philippines"
          className="report-document-logo"
        />
      </div>
      <div className="report-document-header-text">
        <p>
          <span className="report-document-header-initial">R</span>epublic of the{' '}
          <span className="report-document-header-initial">P</span>hilippines
        </p>
        <p>
          <span className="report-document-header-initial">P</span>olytechnic{' '}
          <span className="report-document-header-initial">U</span>niversity of the{' '}
          <span className="report-document-header-initial">P</span>hilippines
        </p>
        <p>
          <span className="report-document-header-initial">O</span>ffice of the{' '}
          <span className="report-document-header-initial">V</span>ice{' '}
          <span className="report-document-header-initial">P</span>resident for{' '}
          <span className="report-document-header-initial">A</span>cademic{' '}
          <span className="report-document-header-initial">A</span>ffairs
        </p>
        <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
      </div>
      <div className="report-document-code-stack">
        <p className="report-document-page-number">
          Page: {pageNumber} of {totalPages}
        </p>
        <div className="report-document-code">
          <p>PUP-ITBL-3-ACAD-010</p>
          <p>REV. 1</p>
          <p>{currentDate}</p>
        </div>
      </div>
    </header>
  );
}
export function ReportDocumentFooter() {
  return (
    <footer className="print-report-footer report-document-footer">
      <div className="print-report-footer-copy">
        <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
        <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
        <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
        <p className="report-document-footer-slogan" aria-label="The Country's 1st PolytechnicU">
          T<span className="print-report-slogan-small-caps">he</span>{' '}
          C<span className="print-report-slogan-small-caps">ountry&apos;s</span>{' '}
          <span className="print-report-slogan-ordinal">
            1<sup>st</sup>
          </span>{' '}
          P<span className="print-report-slogan-small-caps">olytechnic</span>U
        </p>
      </div>
      <img
        src="/iso-certification.png"
        alt="ISO 9001:2015 certified by SOCOTEC and IQNet"
        className="report-document-certification"
      />
    </footer>
  );
}
export function ReportDocumentPageFooter() {
  return (
    <div className="print-report-page-footer">
      <div className="report-document-signatures">
        <div>
          <p>Prepared by:</p>
          <div className="report-document-signature-line" />
          <p>Laboratory Assistant</p>
        </div>
        <div>
          <p>Noted by:</p>
          <div className="report-document-signature-line" />
          <p>Head, CCIS Laboratory</p>
        </div>
      </div>
      <ReportDocumentFooter />
    </div>
  );
}
export function PrintableReportTable<T>({
  definition,
  rows = definition.rows,
  className = 'print-report-table',
}: {
  definition: PrintableReportDefinition<T>;
  rows?: T[];
  className?: string;
}) {
  return (
    <table className={`printable-report-table ${className}`}>
      <colgroup>
        {definition.columns.map((column) => (
          <col key={String(column.key)} style={{ width: column.width } satisfies CSSProperties} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th colSpan={definition.columns.length} className="print-report-table-main-header">
            {definition.title}
            {definition.context && <span className="print-report-header-context">{definition.context}</span>}
          </th>
        </tr>
        <tr>
          {definition.columns.map((column) => (
            <th key={String(column.key)}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${definition.filename}-${index}`}>
            {definition.columns.map((column) => (
              <td key={String(column.key)}>
                {column.render ? column.render(row) : (getColumnValue(row, column) as ReactNode)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PrintableReportDocument<T>({
  definition: sourceDefinition,
  headerPeriod,
  headerRange,
  pages,
  rows,
  minimumRows = 0,
  createBlankRow,
  loading = false,
  error,
  pageClassName = 'print-report-page',
  tableWrapClassName = 'print-report-table-wrap',
  tableClassName = 'print-report-table',
}: {
  definition: PrintableReportDefinition<T>;
  headerPeriod?: { academicYearId: string; termId: string };
  headerRange?: { from: string; to: string };
  pages?: T[][];
  rows?: T[];
  minimumRows?: number;
  createBlankRow?: (index: number) => T;
  loading?: boolean;
  error?: string | null;
  pageClassName?: string;
  tableWrapClassName?: string;
  tableClassName?: string;
}) {
  const [periods, setPeriods] = useState<{ academicYears?: { id: string; year: string }[]; terms?: { id: string; name: string }[] }>({});
  useEffect(() => {
    let active = true;
    academicPeriodApi.get().then(({ data }) => { if (active) setPeriods(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const dateLabel = (value: string) => new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRange = headerRange?.from && headerRange.to ? dateLabel(headerRange.from) + ' – ' + dateLabel(headerRange.to)
    : headerRange?.from ? 'From ' + dateLabel(headerRange.from) : headerRange?.to ? 'Through ' + dateLabel(headerRange.to) : 'All recorded dates';
  const context = [periods.academicYears?.find(year => year.id === headerPeriod?.academicYearId)?.year,
    periods.terms?.find(term => term.id === headerPeriod?.termId)?.name, dateRange].filter(Boolean).join(' · ');
  const definition = { ...sourceDefinition, context };
  const sourceRows = rows ?? definition.rows;
  const measurementPageRef = useRef<HTMLDivElement>(null);
  const [measuredPages, setMeasuredPages] = useState<T[][] | null>(null);
  const fallbackPages = pages?.length ? pages : [sourceRows];
  const measurementRows = useMemo(() => {
    if (!createBlankRow) return sourceRows;
    const blankRow = createBlankRow(-1);
    return sourceRows.length > 0 ? [...sourceRows, blankRow] : [blankRow];
  }, [createBlankRow, sourceRows]);

  useLayoutEffect(() => {
    if (loading || error) return undefined;

    const measureFrame = window.requestAnimationFrame(() => {
      const page = measurementPageRef.current;
      const table = page?.querySelector('table');
      const tableWrap = table?.parentElement;
      const tableHead = table?.tHead;
      const tableBody = table?.tBodies[0];

      if (!page || !table || !tableWrap || !tableHead || !tableBody) {
        setMeasuredPages([sourceRows]);
        return;
      }

      const bodyHeight = tableWrap.getBoundingClientRect().height - tableHead.getBoundingClientRect().height - 1;
      const rowElements = Array.from(tableBody.rows);
      const rowHeights = rowElements.map((row) => row.getBoundingClientRect().height);
      const blankHeight = createBlankRow ? rowHeights[rowHeights.length - 1] ?? 0 : 0;
      const realRowHeights = rowHeights.slice(0, sourceRows.length);
      const availableBodyHeight = Math.max(bodyHeight, 1);
      const groupedPages: Array<{ rows: T[]; height: number }> = [];

      let currentRows: T[] = [];
      let currentHeight = 0;

      sourceRows.forEach((row, index) => {
        const rowHeight = Math.max(realRowHeights[index] ?? blankHeight, 1);
        if (currentRows.length > 0 && currentHeight + rowHeight > availableBodyHeight) {
          groupedPages.push({ rows: currentRows, height: currentHeight });
          currentRows = [];
          currentHeight = 0;
        }
        currentRows.push(row);
        currentHeight += rowHeight;
      });

      if (currentRows.length > 0 || groupedPages.length === 0) {
        groupedPages.push({ rows: currentRows, height: currentHeight });
      }

      const paginatedRows = groupedPages.map(({ rows: pageRows, height }) => {
        if (!createBlankRow || blankHeight <= 0) return pageRows;

        const filledRows = [...pageRows];
        let filledHeight = height;
        while (
          filledRows.length < minimumRows &&
          filledHeight + blankHeight <= availableBodyHeight
        ) {
          filledRows.push(createBlankRow(filledRows.length));
          filledHeight += blankHeight;
        }
        return filledRows;
      });

      setMeasuredPages(paginatedRows);
    });

    return () => window.cancelAnimationFrame(measureFrame);
  }, [createBlankRow, error, loading, minimumRows, sourceRows, context, sourceDefinition.title]);

  const displayPages = loading || error ? [[]] : measuredPages ?? fallbackPages;
  const totalPages = Math.max(displayPages.length, 1);

  return (
    <main className="print-report-paper report-document-paper shadow-lg print:shadow-none">
      <div
        ref={measurementPageRef}
        className={`${pageClassName} printable-report-measurement`}
        aria-hidden="true"
        style={{ height: '214mm', minHeight: '214mm', maxHeight: '214mm' }}
      >
        <ReportDocumentHeader pageNumber={1} totalPages={1} />
        <div className={tableWrapClassName}>
          <PrintableReportTable
            definition={definition}
            rows={measurementRows}
            className={tableClassName}
          />
        </div>
        <ReportDocumentPageFooter />
      </div>
      {displayPages.map((pageRows, pageIndex) => (
        <div className={pageClassName} key={`${definition.filename}-page-${pageIndex}`}>
          <ReportDocumentHeader pageNumber={pageIndex + 1} totalPages={totalPages} />
          {loading || error ? (
            <p
              className={`flex-1 py-12 text-center text-sm ${
                error ? 'text-[#b91c1c]' : 'text-[#6b7280]'
              }`}
            >
              {error ?? 'Loading report…'}
            </p>
          ) : (
            <div className={tableWrapClassName}>
              <PrintableReportTable
                definition={definition}
                rows={pageRows}
                className={tableClassName}
              />
            </div>
          )}
          <ReportDocumentPageFooter />
        </div>
      ))}
    </main>
  );
}

