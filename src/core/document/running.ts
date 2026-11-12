import { clusterObjects } from '../geometry/cluster';
import type { ExtractedTable } from '../table/table';
import type { PageLine, PageSummary } from './page-summary';

/** Running content repeats at (about) the same y on pages; this is the y tolerance in points. */
const Y_TOLERANCE = 3;
/** Share of pages an item must appear on to count as running (and at least 2 pages). */
const MIN_PAGE_SHARE = 0.5;
/** Running items above this fraction of the page height are headers; below FOOTER_FROM, footers. */
const HEADER_UNTIL = 0.4;
const FOOTER_FROM = 0.75;

export interface RunningContent {
  /** Header rows, taken once from the first page that has them. */
  header: string[][];
  /** Footer rows, taken once from the last page that has them. */
  footer: string[][];
  /** Tables that are part of the page furniture (e.g. a repeated customer box), not data. */
  runningTables: Set<ExtractedTable>;
  /** Lines that belong to the header or footer, on every page they appear on. */
  runningLines: Set<PageLine>;
}

type Item = { kind: 'line'; line: PageLine } | { kind: 'table'; table: ExtractedTable };

interface Occurrence {
  page: number;
  top: number;
  key: string;
  item: Item;
}

/** Page numbers and similar counters differ per page, so digits are ignored when comparing. */
export function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

function occurrences(page: PageSummary): Occurrence[] {
  const lines = page.lines.map((line): Occurrence => ({
    page: page.pageNumber, top: line.top, key: `L:${normalizeKey(line.cells.join(' '))}`, item: { kind: 'line', line },
  }));
  // Tables must repeat exactly: data tables with the same layout on every page often differ
  // only in their numbers, and must not be mistaken for page furniture.
  const tables = page.tables.map((table): Occurrence => ({
    page: page.pageNumber,
    top: table.bbox.top,
    key: `T:${table.rows.map((r) => r.join('|')).join('/').replace(/\s+/g, ' ').trim()}`,
    item: { kind: 'table', table },
  }));
  return [...lines, ...tables];
}

function findRunning(pages: readonly PageSummary[]): Occurrence[] {
  if (pages.length < 2) return [];
  const threshold = Math.max(2, Math.ceil(MIN_PAGE_SHARE * pages.length));
  const byKey = new Map<string, Occurrence[]>();
  for (const occ of pages.flatMap(occurrences)) {
    if (occ.key.length <= 2) continue;
    byKey.set(occ.key, [...(byKey.get(occ.key) ?? []), occ]);
  }
  const running: Occurrence[] = [];
  for (const group of byKey.values()) {
    for (const cluster of clusterObjects(group, (o) => o.top, Y_TOLERANCE)) {
      if (new Set(cluster.map((o) => o.page)).size >= threshold) running.push(...cluster);
    }
  }
  return running;
}

function rowsOf(item: Item): string[][] {
  return item.kind === 'line' ? [item.line.cells] : item.table.rows;
}

/** Rows of the running items in one band, from a single page (first page for headers, last for footers). */
function bandRows(items: Occurrence[], pickLast: boolean): string[][] {
  if (items.length === 0) return [];
  const pageNos = items.map((o) => o.page);
  const page = pickLast ? Math.max(...pageNos) : Math.min(...pageNos);
  return items
    .filter((o) => o.page === page)
    .sort((a, b) => a.top - b.top)
    .flatMap((o) => rowsOf(o.item));
}

/**
 * Finds headers and footers that repeat across pages. Lines inside tables are never
 * candidates, so a table's own header row (repeated on every page) stays with the table.
 */
export function findRunningContent(pages: readonly PageSummary[]): RunningContent {
  const heights = new Map(pages.map((p) => [p.pageNumber, p.height]));
  const running = findRunning(pages);
  const relTop = (o: Occurrence): number => o.top / (heights.get(o.page) ?? 1);
  const headerItems = running.filter((o) => relTop(o) < HEADER_UNTIL);
  const footerItems = running.filter((o) => relTop(o) >= FOOTER_FROM);
  const bands = [...headerItems, ...footerItems];
  return {
    header: bandRows(headerItems, false),
    footer: bandRows(footerItems, true),
    runningTables: new Set(bands.flatMap((o) => (o.item.kind === 'table' ? [o.item.table] : []))),
    runningLines: new Set(bands.flatMap((o) => (o.item.kind === 'line' ? [o.item.line] : []))),
  };
}
