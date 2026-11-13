import { describe, expect, it } from 'vitest';
import { cellsToTables, intersectionsToCells } from '../../../src/core/lattice/cells';
import { edgesToIntersections } from '../../../src/core/lattice/intersections';
import type { Edge } from '../../../src/core/geometry/types';

const h = (x0: number, x1: number, y: number): Edge => ({
  orientation: 'h', x0, x1, top: y, bottom: y, width: x1 - x0, height: 0,
});
const v = (x: number, top: number, bottom: number): Edge => ({
  orientation: 'v', x0: x, x1: x, top, bottom, width: 0, height: bottom - top,
});
const TOL = { x: 3, y: 3 };

/** A full grid: `xs` column lines and `ys` row lines, offset by (ox, oy). */
function grid(xs: number[], ys: number[]): Edge[] {
  const [xa, xb, ya, yb] = [xs[0], xs[xs.length - 1], ys[0], ys[ys.length - 1]];
  return [...xs.map((x) => v(x, ya, yb)), ...ys.map((y) => h(xa, xb, y))];
}

describe('edgesToIntersections', () => {
  it('finds a vertex at every crossing of a full grid', () => {
    expect(edgesToIntersections(grid([0, 50, 100], [0, 20, 40]), TOL).size).toBe(9);
  });

  it('accepts edges that stop just short of each other (within tolerance)', () => {
    const edges = [h(0, 48, 10), v(50, 0, 30)]; // h ends 2pt before v
    expect(edgesToIntersections(edges, TOL).size).toBe(1);
  });

  it('ignores edges that are too far apart', () => {
    expect(edgesToIntersections([h(0, 40, 10), v(50, 0, 30)], TOL).size).toBe(0);
  });
});

describe('intersectionsToCells', () => {
  it('produces one cell per grid square', () => {
    const cells = intersectionsToCells(edgesToIntersections(grid([0, 50, 100], [0, 20, 40]), TOL));
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ x0: 0, top: 0, x1: 50, bottom: 20 });
    expect(cells).toContainEqual({ x0: 50, top: 20, x1: 100, bottom: 40 });
  });

  it('merges a spanning cell when the dividing vertical line is missing', () => {
    // Column lines at 0, 50, 100 but the x=50 line only covers the top row.
    const edges = [v(0, 0, 40), v(100, 0, 40), v(50, 0, 20), h(0, 100, 0), h(0, 100, 20), h(0, 100, 40)];
    const cells = intersectionsToCells(edgesToIntersections(edges, TOL));
    expect(cells).toContainEqual({ x0: 0, top: 20, x1: 100, bottom: 40 });
    expect(cells).toHaveLength(3);
  });

  it('returns nothing when edges do not close a rectangle', () => {
    const edges = [h(0, 100, 0), h(0, 100, 20), v(0, 0, 20)];
    expect(intersectionsToCells(edgesToIntersections(edges, TOL))).toEqual([]);
  });
});

describe('cellsToTables', () => {
  it('groups connected cells into one table', () => {
    const cells = intersectionsToCells(edgesToIntersections(grid([0, 50, 100], [0, 20, 40]), TOL));
    expect(cellsToTables(cells)).toHaveLength(1);
  });

  it('separates tables that share no corners and sorts top to bottom', () => {
    const lower = grid([0, 50, 100], [200, 220, 240]);
    const upper = grid([0, 50, 100], [0, 20, 40]);
    const cells = intersectionsToCells(edgesToIntersections([...lower, ...upper], TOL));
    const tables = cellsToTables(cells);
    expect(tables).toHaveLength(2);
    expect(Math.min(...tables[0].map((c) => c.top))).toBe(0);
    expect(Math.min(...tables[1].map((c) => c.top))).toBe(200);
  });

  it('drops single-cell boxes', () => {
    const cells = intersectionsToCells(edgesToIntersections(grid([0, 50], [0, 20]), TOL));
    expect(cells).toHaveLength(1);
    expect(cellsToTables(cells)).toEqual([]);
  });
});
