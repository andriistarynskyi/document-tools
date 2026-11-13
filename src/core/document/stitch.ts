import type { ColumnRange, DocTable, Merge } from './doc-table';
import { normalizeKey } from './running';

/** A continuation column may sit this far (pts) outside the matching column of the first part. */
const COLUMN_SLACK = 4;
/** Share of the first part's columns the continuation must cover. */
const MIN_COLUMN_COVERAGE = 0.75;

const centre = (c: ColumnRange): number => (c.x0 + c.x1) / 2;

/**
 * Maps every column of `next` onto a column of `base` by x-position. Several columns may map
 * onto one (a value split off on one page, glued on another). Null when a column has no match.
 */
export function mapColumns(next: readonly ColumnRange[], base: readonly ColumnRange[]): number[] | null {
  const map: number[] = [];
  for (const col of next) {
    const x = centre(col);
    const hit = base.findIndex((b) => x >= b.x0 - COLUMN_SLACK && x <= b.x1 + COLUMN_SLACK);
    if (hit < 0) return null;
    map.push(hit);
  }
  return map;
}

function remapRow(row: readonly string[], map: readonly number[], width: number): string[] {
  const out = new Array<string>(width).fill('');
  row.forEach((text, i) => {
    if (text) out[map[i]] = out[map[i]] ? `${out[map[i]]} ${text}` : text;
  });
  return out;
}

function remapMerge(m: Merge, map: readonly number[], rowOffset: number): Merge | null {
  const col = map[m.col];
  const colSpan = map[m.col + m.colSpan - 1] - col + 1;
  if (m.rowSpan === 1 && colSpan <= 1) return null;
  return { row: m.row + rowOffset, col, rowSpan: m.rowSpan, colSpan: Math.max(1, colSpan) };
}

const sameRow = (a: readonly string[], b: readonly string[]): boolean =>
  normalizeKey(a.join(' ')) === normalizeKey(b.join(' '));

/**
 * Wrapped text carried over from the previous page: a first row with one filled cell (not the
 * first column, which is more likely a row label) under a filled cell in the last row.
 */
function isCarriedOver(row: readonly string[], last: readonly string[]): boolean {
  const filled = row.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
  return filled.length === 1 && filled[0] > 0 && last[filled[0]] !== '';
}

/**
 * Says whether nothing but running headers/footers separates the end of `base` (on its last
 * page) from the start of `next` (on the following page).
 */
export type GapCheck = (base: DocTable, next: DocTable) => boolean;

/**
 * Appends `next` to `base`, or returns false when `next` does not continue `base`. Matching
 * columns are not enough (separate tables often share a layout, even the same header row):
 * nothing but running headers/footers may sit between the two parts.
 */
function tryAppend(base: DocTable, next: DocTable, isGapClear: GapCheck): boolean {
  const map = mapColumns(next.columns, base.columns);
  if (!map || new Set(map).size < Math.ceil(MIN_COLUMN_COVERAGE * base.columns.length)) return false;
  if (!isGapClear(base, next)) return false;

  const width = base.columns.length;
  let rows = next.rows.map((r) => remapRow(r, map, width));
  let skipped = 0;
  if (rows.length > 0 && sameRow(rows[0], base.rows[0])) {
    rows = rows.slice(1);
    skipped = 1;
  }
  const last = base.rows[base.rows.length - 1];
  if (rows.length && last && isCarriedOver(rows[0], last)) {
    const col = rows[0].findIndex(Boolean);
    last[col] = `${last[col]}\n${rows[0][col]}`;
    rows = rows.slice(1);
    skipped++;
  }
  const offset = base.rows.length - skipped;
  base.merges.push(
    ...next.merges.filter((m) => m.row >= skipped).flatMap((m) => remapMerge(m, map, offset) ?? []),
  );
  base.rows.push(...rows);
  base.pages.push(...next.pages.filter((p) => !base.pages.includes(p)));
  base.bottom = next.bottom;
  return true;
}

/**
 * Joins tables that continue onto the next page. A candidate pair is the last table on one
 * page and the first table on the following page; see `tryAppend` for when they join.
 * Input must be in document order.
 */
export function stitchTables(tables: readonly DocTable[], isGapClear: GapCheck = () => true): DocTable[] {
  const out: DocTable[] = [];
  tables.forEach((table, i) => {
    const prev = tables[i - 1];
    const base = out[out.length - 1];
    const startPage = table.pages[0];
    const isPageBoundary = prev !== undefined && prev.pages[prev.pages.length - 1] !== startPage;
    const isAdjacent = base !== undefined && base.pages[base.pages.length - 1] === startPage - 1;
    const copy: DocTable = { ...table, rows: table.rows.map((r) => [...r]), merges: [...table.merges], pages: [...table.pages] };
    if (!(isPageBoundary && isAdjacent && tryAppend(base, copy, isGapClear))) out.push(copy);
  });
  return out;
}
