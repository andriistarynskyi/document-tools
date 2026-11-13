import { isCentreInside, objectsToBBox } from '../geometry/geometry';
import type { BBox, Char } from '../geometry/types';
import { buildTable, type ExtractedTable } from '../table/table';

const TOLERANCE = 1;

const contains = (outer: BBox, inner: BBox): boolean =>
  outer.x0 - TOLERANCE <= inner.x0 && inner.x1 <= outer.x1 + TOLERANCE &&
  outer.top - TOLERANCE <= inner.top && inner.bottom <= outer.bottom + TOLERANCE;

const filledColumns = (t: ExtractedTable): number =>
  t.rows[0].filter((_, c) => t.rows.some((r) => r[c] !== '')).length;

/**
 * Builds tables from cell groups, handling boxes drawn inside a cell of another table.
 * Every char ends up in exactly one table:
 * - a nested box with at most one filled column (labels such as "SUB TOTAL / G.S.T.") is
 *   dropped, and its text stays in the outer cell next to the values it labels;
 * - a real nested table is kept, and its text is removed from the outer cell.
 */
export function buildTables(page: number, groups: readonly BBox[][], chars: readonly Char[]): ExtractedTable[] {
  const bounds = groups.map(objectsToBBox);
  const isNested = groups.map((_, i) => groups.some((g, j) => j !== i && g.some((cell) => contains(cell, bounds[i]))));

  const nested = groups
    .map((g, i) => (isNested[i] ? buildTable(page, g, chars) : null))
    .filter((t): t is ExtractedTable => t !== null && filledColumns(t) >= 2);
  const claimed = nested.map((t) => t.bbox);
  const outerChars = chars.filter((c) => !claimed.some((b) => isCentreInside(c, b)));

  const outer = groups.flatMap((g, i) => (isNested[i] ? [] : [buildTable(page, g, outerChars)]));
  return [...outer, ...nested].sort((a, b) => a.bbox.top - b.bbox.top || a.bbox.x0 - b.bbox.x0);
}
