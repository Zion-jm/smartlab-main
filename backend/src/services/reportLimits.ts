import { DomainError } from './domainError';
export const REPORT_MAX_ROWS = 1000;
export function assertReportSize(rows: readonly unknown[]) {
  if (rows.length > REPORT_MAX_ROWS) throw new DomainError(413, 'Report exceeds 1000 records. Narrow the date range or filters.', 'REPORT_TOO_LARGE');
}
let active = false;
/** Reject excess work before querying/rendering; release the slot even after failure. */
export function limitedReport<Args extends unknown[], Result>(task: (...args: Args) => Promise<Result>) {
  return async (...args: Args): Promise<Result> => {
    if (active) throw new DomainError(503, 'Another report is being generated. Please retry shortly.', 'REPORT_BUSY');
    active = true;
    try { return await task(...args); } finally { active = false; }
  };
}
