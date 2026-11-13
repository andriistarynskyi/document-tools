/** A cell's position on the table grid (zero-based, spans of at least 1). */
export interface Slot {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

type Grid = boolean[][];

const area = (s: Slot): number => s.rowSpan * s.colSpan;

function isFree(grid: Grid, s: Slot): boolean {
  for (let r = s.row; r < s.row + s.rowSpan; r++) {
    for (let c = s.col; c < s.col + s.colSpan; c++) if (grid[r][c]) return false;
  }
  return true;
}

function occupy(grid: Grid, s: Slot): void {
  for (let r = s.row; r < s.row + s.rowSpan; r++) {
    for (let c = s.col; c < s.col + s.colSpan; c++) grid[r][c] = true;
  }
}

/** Largest free rectangle starting at (row, col) inside `bounds`: grow right first, then down. */
function growFrom(grid: Grid, bounds: Slot, row: number, col: number): Slot {
  let colSpan = 1;
  while (col + colSpan < bounds.col + bounds.colSpan && !grid[row][col + colSpan]) colSpan++;
  let rowSpan = 1;
  while (row + rowSpan < bounds.row + bounds.rowSpan && isFree(grid, { row: row + rowSpan, col, rowSpan: 1, colSpan })) {
    rowSpan++;
  }
  return { row, col, rowSpan, colSpan };
}

/** Covers the still-free positions of `bounds` with non-overlapping rectangles (row-major). */
function coverFree(grid: Grid, bounds: Slot): Slot[] {
  const pieces: Slot[] = [];
  for (let r = bounds.row; r < bounds.row + bounds.rowSpan; r++) {
    for (let c = bounds.col; c < bounds.col + bounds.colSpan; c++) {
      if (grid[r][c]) continue;
      const piece = growFrom(grid, bounds, r, c);
      occupy(grid, piece);
      pieces.push(piece);
    }
  }
  return pieces;
}

/**
 * Makes cells disjoint. Partly drawn borders can make the ruled-table search report a large
 * cell on top of smaller ones; a spreadsheet cannot merge cells twice. Smaller cells win
 * (they follow the lines actually drawn) and what a larger cell still covers is split into
 * non-overlapping pieces, so no area (and no text) is lost.
 */
export function resolveOverlaps(slots: readonly Slot[], rowCount: number, colCount: number): Slot[] {
  const grid: Grid = Array.from({ length: rowCount }, () => new Array<boolean>(colCount).fill(false));
  const ordered = [...slots].sort((a, b) => area(a) - area(b) || a.row - b.row || a.col - b.col);
  const out: Slot[] = [];
  for (const slot of ordered) {
    if (isFree(grid, slot)) {
      occupy(grid, slot);
      out.push(slot);
    } else {
      out.push(...coverFree(grid, slot));
    }
  }
  return out.sort((a, b) => a.row - b.row || a.col - b.col);
}
