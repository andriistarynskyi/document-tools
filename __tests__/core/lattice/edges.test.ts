import { describe, expect, it } from 'vitest';
import { filterEdges, mergeEdges, snapEdges } from '../../../src/core/lattice/edges';
import type { Edge } from '../../../src/core/geometry/types';

const h = (x0: number, x1: number, y: number): Edge => ({
  orientation: 'h', x0, x1, top: y, bottom: y, width: x1 - x0, height: 0,
});
const v = (x: number, top: number, bottom: number): Edge => ({
  orientation: 'v', x0: x, x1: x, top, bottom, width: 0, height: bottom - top,
});
const TOL = { snapX: 3, snapY: 3, joinX: 3, joinY: 3 };

describe('snapEdges', () => {
  it('moves nearby horizontal edges onto their mean y', () => {
    const snapped = snapEdges([h(0, 10, 100), h(0, 10, 102)], 3, 3);
    expect(snapped.map((e) => e.top)).toEqual([101, 101]);
    expect(snapped.every((e) => e.bottom === 101)).toBe(true);
  });

  it('moves nearby vertical edges onto their mean x', () => {
    const snapped = snapEdges([v(50, 0, 10), v(51, 0, 10)], 3, 3);
    expect(snapped.map((e) => e.x0)).toEqual([50.5, 50.5]);
    expect(snapped.every((e) => e.x1 === 50.5)).toBe(true);
  });

  it('leaves distant edges alone', () => {
    expect(snapEdges([h(0, 10, 100), h(0, 10, 120)], 3, 3).map((e) => e.top)).toEqual([100, 120]);
  });
});

describe('mergeEdges', () => {
  it('joins touching collinear segments', () => {
    const merged = mergeEdges([h(0, 50, 10), h(50, 100, 10)], TOL);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ x0: 0, x1: 100, width: 100 });
  });

  it('joins segments separated by a gap within the join tolerance', () => {
    expect(mergeEdges([h(0, 50, 10), h(52, 100, 10)], TOL)).toHaveLength(1);
  });

  it('keeps segments separated by more than the join tolerance', () => {
    expect(mergeEdges([h(0, 50, 10), h(60, 100, 10)], TOL)).toHaveLength(2);
  });

  it('snaps first, so slightly offset segments become one line', () => {
    const merged = mergeEdges([h(0, 50, 10), h(40, 100, 11)], TOL);
    expect(merged).toHaveLength(1);
    expect(merged[0].x1).toBe(100);
  });

  it('does not join horizontal and vertical edges', () => {
    expect(mergeEdges([h(0, 50, 10), v(10, 0, 50)], TOL)).toHaveLength(2);
  });

  it('keeps the longer extent when one segment contains another', () => {
    const merged = mergeEdges([h(0, 100, 10), h(20, 40, 10)], TOL);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ x0: 0, x1: 100 });
  });
});

describe('filterEdges', () => {
  it('drops edges shorter than the minimum along their own axis', () => {
    const kept = filterEdges([h(0, 2, 5), h(0, 20, 5), v(5, 0, 2), v(5, 0, 20)], 3);
    expect(kept).toHaveLength(2);
  });
});
