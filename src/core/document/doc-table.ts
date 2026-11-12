import type { ExtractedTable } from '../table/table';

/** A merged cell in a document table (only cells larger than 1x1 are listed). */
export interface Merge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface ColumnRange {
  x0: number;
  x1: number;
}

/** A table after cross-page stitching: plain rows, merged cells and its column geometry. */
export interface DocTable {
  /** Pages the table spans, ascending. */
  pages: number[];
  rows: string[][];
  merges: Merge[];
  /** Column x-ranges of the first part; used to align continuation parts on later pages. */
  columns: ColumnRange[];
  /** Top of the first part (on the first page) and bottom of the last part (on the last page). */
  top: number;
  bottom: number;
}

/** Rebuilds the grid's vertical lines from cell edges (every grid line is some cell's edge). */
export function columnRanges(table: ExtractedTable): ColumnRange[] {
  const xs: Array<number | undefined> = new Array(table.colCount + 1).fill(undefined);
  for (const cell of table.cells) {
    xs[cell.col] ??= cell.bbox.x0;
    xs[cell.col + cell.colSpan] ??= cell.bbox.x1;
  }
  xs[0] ??= table.bbox.x0;
  xs[table.colCount] ??= table.bbox.x1;
  for (let i = 1; i < xs.length; i++) xs[i] ??= xs[i - 1];
  return Array.from({ length: table.colCount }, (_, c) => ({ x0: xs[c] as number, x1: xs[c + 1] as number }));
}

export function toDocTable(table: ExtractedTable): DocTable {
  return {
    pages: [table.page],
    rows: table.rows.map((r) => [...r]),
    merges: table.cells
      .filter((c) => c.rowSpan > 1 || c.colSpan > 1)
      .map(({ row, col, rowSpan, colSpan }) => ({ row, col, rowSpan, colSpan })),
    columns: columnRanges(table),
    top: table.bbox.top,
    bottom: table.bbox.bottom,
  };
}
