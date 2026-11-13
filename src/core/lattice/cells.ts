/*
 * Ported from pdfplumber (https://github.com/jsvine/pdfplumber), table.py
 * (intersections_to_cells, cells_to_tables).
 * pdfplumber is MIT licensed. Copyright (c) 2015 Jeremy Singer-Vine.
 * See the license banner emitted into the production bundle.
 */
import type { BBox } from '../geometry/types';
import { vertexKey, type Intersections, type Vertex } from './intersections';

type Point = readonly [number, number];

/** Lexicographic (x, then y) order, the same ordering pdfplumber sorts vertices by. */
const byXThenY = (a: Vertex, b: Vertex): number => a.x - b.x || a.y - b.y;

/** True when both vertices lie on the same drawn edge (same column or same row line). */
function connects(a: Vertex, b: Vertex): boolean {
  if (a.x === b.x && a.v.some((e) => b.v.includes(e))) return true;
  if (a.y === b.y && a.h.some((e) => b.h.includes(e))) return true;
  return false;
}

function smallestCell(points: Vertex[], i: number, all: Intersections): BBox | null {
  const pt = points[i];
  const rest = points.slice(i + 1);
  const below = rest.filter((p) => p.x === pt.x);
  const right = rest.filter((p) => p.y === pt.y);

  for (const b of below) {
    if (!connects(pt, b)) continue;
    for (const r of right) {
      if (!connects(pt, r)) continue;
      const corner = all.get(vertexKey(r.x, b.y));
      if (corner && connects(corner, r) && connects(corner, b)) {
        return { x0: pt.x, top: pt.y, x1: corner.x, bottom: corner.y };
      }
    }
  }
  return null;
}

/** Finds the smallest rectangle whose four corners are joined by drawn edges, per vertex. */
export function intersectionsToCells(intersections: Intersections): BBox[] {
  const points = [...intersections.values()].sort(byXThenY);
  const cells: BBox[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const cell = smallestCell(points, i, intersections);
    if (cell) cells.push(cell);
  }
  return cells;
}

const corners = (c: BBox): Point[] => [
  [c.x0, c.top], [c.x0, c.bottom], [c.x1, c.top], [c.x1, c.bottom],
];
const pointKey = (p: Point): string => `${p[0]},${p[1]}`;

/** Groups cells into tables: cells that share at least one corner belong together. */
export function cellsToTables(cells: readonly BBox[]): BBox[][] {
  const remaining = [...cells];
  const tables: BBox[][] = [];
  let current: BBox[] = [];
  const seen = new Set<string>();

  while (remaining.length > 0) {
    const before = current.length;
    for (const cell of [...remaining]) {
      const cs = corners(cell);
      if (current.length === 0 || cs.some((p) => seen.has(pointKey(p)))) {
        cs.forEach((p) => seen.add(pointKey(p)));
        current.push(cell);
        remaining.splice(remaining.indexOf(cell), 1);
      }
    }
    if (current.length === before) {
      tables.push(current);
      current = [];
      seen.clear();
    }
  }
  if (current.length > 0) tables.push(current);

  const topLeft = (t: BBox[]): [number, number] =>
    t.reduce<[number, number]>(
      (best, c) => (c.top < best[0] || (c.top === best[0] && c.x0 < best[1]) ? [c.top, c.x0] : best),
      [Infinity, Infinity],
    );
  return tables
    .filter((t) => t.length > 1)
    .sort((a, b) => topLeft(a)[0] - topLeft(b)[0] || topLeft(a)[1] - topLeft(b)[1]);
}
