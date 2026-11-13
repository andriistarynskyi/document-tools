import type { BBox } from '../geometry/types';

/** y positions that no cell crosses: the table can be cut there without splitting a cell. */
function cutPositions(cells: readonly BBox[]): number[] {
  const ys = [...new Set(cells.flatMap((c) => [c.top, c.bottom]))].sort((a, b) => a - b);
  return ys.filter((y) => !cells.some((c) => c.top < y && y < c.bottom));
}

/** Cells grouped into horizontal bands between consecutive cut positions, top to bottom. */
export function toBands(cells: readonly BBox[]): BBox[][] {
  const cuts = cutPositions(cells);
  const bands: BBox[][] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const band = cells.filter((c) => c.top >= cuts[i] && c.bottom <= cuts[i + 1]);
    if (band.length) bands.push(band);
  }
  return bands;
}

/** All vertical lines of a band, outer edges included, ascending. */
function columnLines(band: readonly BBox[]): number[] {
  return [...new Set(band.flatMap((c) => [c.x0, c.x1]))].sort((a, b) => a - b);
}

/** Inner column lines of a band (its outer left and right edges excluded). */
export function innerColumnLines(band: readonly BBox[]): number[] {
  return columnLines(band).slice(1, -1);
}

const isSubset = (a: ReadonlySet<number>, b: ReadonlySet<number>): boolean => [...a].every((x) => b.has(x));

/**
 * A band continues a table when its column lines (outer edges included) and the lines the
 * table has so far are a subset one way or the other. That covers merged headers ("2008"
 * over "Yes | No"), full-width title or section rows and total rows, but not a narrower box
 * or a different set of columns.
 */
function continuesLayout(lines: ReadonlySet<number>, band: readonly BBox[]): boolean {
  const own = new Set(columnLines(band));
  return isSubset(own, lines) || isSubset(lines, own);
}

/**
 * Splits a ruled box into separate tables where its column layout changes. Forms often draw
 * several tables (a field box, the item table, a totals box) inside one shared border.
 */
export function splitByColumnLayout(cells: readonly BBox[]): BBox[][] {
  const groups: Array<{ cells: BBox[]; lines: Set<number> }> = [];
  for (const band of toBands(cells)) {
    const current = groups[groups.length - 1];
    if (current && continuesLayout(current.lines, band)) {
      current.cells.push(...band);
      columnLines(band).forEach((x) => current.lines.add(x));
    } else {
      groups.push({ cells: [...band], lines: new Set(columnLines(band)) });
    }
  }
  return groups.map((g) => g.cells);
}
