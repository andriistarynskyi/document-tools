import { isCentreInside } from '../geometry/geometry';
import type { BBox, Char } from '../geometry/types';
import { extractText } from '../text/words';
import { resolveOverlaps, type Slot } from './slots';

export interface TableCell {
  bbox: BBox;
  /** Zero-based grid position of the cell's top-left corner. */
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  text: string;
}

export interface ExtractedTable {
  page: number;
  bbox: BBox;
  rowCount: number;
  colCount: number;
  cells: TableCell[];
  /** Dense grid of cell text. Positions covered by a spanning cell hold ''. */
  rows: string[][];
}

/** Sorted unique values. Coordinates come from shared snapped edges, so exact equality is safe. */
function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function indexOfValue(sorted: number[]): Map<number, number> {
  return new Map(sorted.map((v, i) => [v, i]));
}

function toSlot(bbox: BBox, xi: Map<number, number>, yi: Map<number, number>): Slot {
  const row = yi.get(bbox.top) ?? 0;
  const col = xi.get(bbox.x0) ?? 0;
  return {
    row,
    col,
    rowSpan: Math.max(1, (yi.get(bbox.bottom) ?? row + 1) - row),
    colSpan: Math.max(1, (xi.get(bbox.x1) ?? col + 1) - col),
  };
}

/**
 * Builds a table from its cell boxes. The grid lines are the union of all cell edges, so a
 * cell that covers several grid slots (merged cell) gets a rowSpan / colSpan above 1.
 * Overlapping cells are made disjoint first (see `resolveOverlaps`).
 */
export function buildTable(page: number, cellBoxes: readonly BBox[], chars: readonly Char[]): ExtractedTable {
  const xs = uniqueSorted(cellBoxes.flatMap((c) => [c.x0, c.x1]));
  const ys = uniqueSorted(cellBoxes.flatMap((c) => [c.top, c.bottom]));
  const xi = indexOfValue(xs);
  const yi = indexOfValue(ys);
  const rowCount = ys.length - 1;
  const colCount = xs.length - 1;

  const slots = resolveOverlaps(cellBoxes.map((b) => toSlot(b, xi, yi)), rowCount, colCount);
  const cells: TableCell[] = slots.map((slot) => {
    const bbox = { x0: xs[slot.col], x1: xs[slot.col + slot.colSpan], top: ys[slot.row], bottom: ys[slot.row + slot.rowSpan] };
    return { ...slot, bbox, text: extractText(chars.filter((ch) => isCentreInside(ch, bbox))) };
  });

  const rows = Array.from({ length: rowCount }, () => new Array<string>(colCount).fill(''));
  for (const c of cells) rows[c.row][c.col] = c.text;

  return {
    page,
    bbox: {
      x0: xs[0], top: ys[0], x1: xs[xs.length - 1], bottom: ys[ys.length - 1],
    },
    rowCount,
    colCount,
    cells,
    rows,
  };
}
