import type { PageLine, PageSummary } from '../../src/core/document/page-summary';
import type { ExtractedTable, TableCell } from '../../src/core/table/table';

export const ROW_H = 20;

export function pageLine(cells: string[], top: number, x0 = 50): PageLine {
  return { cells, top, bottom: top + 10, x0, x1: x0 + 200 };
}

/** A plain grid table: `xs` are the column lines, rows are ROW_H tall starting at `top`. */
export function gridTable(page: number, rows: string[][], xs: number[], top: number): ExtractedTable {
  const cells: TableCell[] = rows.flatMap((row, r) =>
    row.map((text, c) => ({
      bbox: { x0: xs[c], x1: xs[c + 1], top: top + r * ROW_H, bottom: top + (r + 1) * ROW_H },
      row: r, col: c, rowSpan: 1, colSpan: 1, text,
    })),
  );
  return {
    page,
    bbox: { x0: xs[0], x1: xs[xs.length - 1], top, bottom: top + rows.length * ROW_H },
    rowCount: rows.length,
    colCount: xs.length - 1,
    cells,
    rows,
  };
}

export function summary(pageNumber: number, tables: ExtractedTable[], lines: PageLine[] = []): PageSummary {
  return { pageNumber, height: 792, tables, lines };
}
