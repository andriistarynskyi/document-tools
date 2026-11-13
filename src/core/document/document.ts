import { toDocTable, type DocTable } from './doc-table';
import { cleanText, normalizeTable } from './normalize';
import type { PageLine, PageSummary } from './page-summary';
import { findRunningContent } from './running';
import { stitchTables, type GapCheck } from './stitch';

export interface DocumentResult {
  pageCount: number;
  /** Running header rows (once, from the first page). Empty for single-page documents. */
  header: string[][];
  /** Running footer rows (once, from the last page). */
  footer: string[][];
  tables: DocTable[];
}

const cleanRows = (rows: string[][]): string[][] =>
  rows.map((r) => r.map(cleanText)).filter((r) => r.some(Boolean));

/** Body text (non-running lines) per page number. */
function bodyLinesByPage(pages: readonly PageSummary[], running: ReadonlySet<PageLine>): Map<number, PageLine[]> {
  return new Map(pages.map((p) => [p.pageNumber, p.lines.filter((l) => !running.has(l))]));
}

/** Clear when no body text follows `base` on its page and none precedes `next` on its page. */
function gapCheck(body: Map<number, PageLine[]>): GapCheck {
  return (base, next) => {
    const after = body.get(base.pages[base.pages.length - 1]) ?? [];
    const before = body.get(next.pages[0]) ?? [];
    return !after.some((l) => l.top >= base.bottom) && !before.some((l) => l.bottom <= next.top);
  };
}

/**
 * Assembles page summaries into one document: running headers and footers are pulled out
 * once, tables continuing across pages are joined, and every table is cleaned up.
 */
export function buildDocument(pages: readonly PageSummary[]): DocumentResult {
  const running = findRunningContent(pages);
  const parts = pages.flatMap((p) => p.tables.filter((t) => !running.runningTables.has(t)).map(toDocTable));
  const tables = stitchTables(parts, gapCheck(bodyLinesByPage(pages, running.runningLines)))
    .map(normalizeTable)
    .filter((t) => t.rows.length > 0);
  return {
    pageCount: pages.length,
    header: cleanRows(running.header),
    footer: cleanRows(running.footer),
    tables,
  };
}
