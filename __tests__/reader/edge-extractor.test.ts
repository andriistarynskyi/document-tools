import { describe, expect, it } from 'vitest';
import type { Matrix } from '../../src/core/geometry/matrix';
import { extractEdges, type OpCodes } from '../../src/reader/edge-extractor';

const CODES: OpCodes = {
  save: 10, restore: 11, transform: 12, constructPath: 91, formBegin: 74, formEnd: 75,
  paintOps: [20, 22],
  fillOnlyOps: [22],
};
const STROKE = 20;
const FILL = 22;
const END_PATH = 28; // clip / no paint
const VIEWPORT: Matrix = [1, 0, 0, -1, 0, 100];

const list = (fn: number[], args: unknown[]) => ({ fnArray: fn, argsArray: args });

// pdf.js payload: [paintOp, [flat coords], minMax]; 0 = move, 1 = line, 4 = close
const rectPath = (x0: number, y0: number, x1: number, y1: number) =>
  [0, x0, y0, 1, x1, y0, 1, x1, y1, 1, x0, y1, 4];

describe('extractEdges', () => {
  it('turns a stroked line into one horizontal edge in top-left coordinates', () => {
    const ops = list([CODES.constructPath], [[STROKE, [[0, 10, 70, 1, 60, 70]], []]]);
    expect(extractEdges(ops, CODES, VIEWPORT)).toEqual([
      { orientation: 'h', x0: 10, x1: 60, top: 30, bottom: 30, width: 50, height: 0 },
    ]);
  });

  it('turns a stroked rectangle into four sides', () => {
    const ops = list([CODES.constructPath], [[STROKE, [rectPath(0, 0, 40, 20)], []]]);
    const edges = extractEdges(ops, CODES, VIEWPORT);
    expect(edges.filter((e) => e.orientation === 'h')).toHaveLength(2);
    expect(edges.filter((e) => e.orientation === 'v')).toHaveLength(2);
  });

  it('treats a thin filled rectangle as a ruling line', () => {
    const ops = list([CODES.constructPath], [[FILL, [rectPath(0, 50, 200, 51)], []]]);
    const edges = extractEdges(ops, CODES, VIEWPORT).filter((e) => e.width >= 3 || e.height >= 3);
    expect(edges.map((e) => e.orientation)).toEqual(['h', 'h']);
  });

  it('ignores filled shading areas, which have no visible border', () => {
    const ops = list([CODES.constructPath], [[FILL, [rectPath(0, 0, 40, 20)], []]]);
    expect(extractEdges(ops, CODES, VIEWPORT)).toEqual([]);
  });

  it('keeps the outline of a stroked rectangle of any size', () => {
    const ops = list([CODES.constructPath], [[STROKE, [rectPath(0, 0, 40, 20)], []]]);
    expect(extractEdges(ops, CODES, VIEWPORT)).toHaveLength(4);
  });

  it('ignores paths that are only used for clipping', () => {
    const ops = list([CODES.constructPath], [[END_PATH, [rectPath(0, 0, 40, 20)], []]]);
    expect(extractEdges(ops, CODES, VIEWPORT)).toEqual([]);
  });

  it('ignores diagonal segments', () => {
    const ops = list([CODES.constructPath], [[STROKE, [[0, 0, 0, 1, 30, 30]], []]]);
    expect(extractEdges(ops, CODES, VIEWPORT)).toEqual([]);
  });

  it('applies the CTM and restores it after restore', () => {
    const path = [STROKE, [[0, 0, 50, 1, 20, 50]], []];
    const ops = list(
      [CODES.save, CODES.transform, CODES.constructPath, CODES.restore, CODES.constructPath],
      [null, [1, 0, 0, 1, 5, 10], path, null, path],
    );
    const edges = extractEdges(ops, CODES, VIEWPORT);
    expect(edges.map((e) => e.x0)).toEqual([5, 0]);
    expect(edges.map((e) => e.top)).toEqual([40, 50]);
  });

  it('skips curves', () => {
    const ops = list([CODES.constructPath], [[STROKE, [[0, 0, 0, 2, 1, 1, 2, 2, 3, 3]], []]]);
    expect(extractEdges(ops, CODES, VIEWPORT)).toEqual([]);
  });
});
