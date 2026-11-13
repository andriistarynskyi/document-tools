import { describe, expect, it } from 'vitest';
import type { BBox } from '../../../src/core/geometry/types';
import { innerColumnLines, splitByColumnLayout, toBands } from '../../../src/core/lattice/bands';

const box = (x0: number, x1: number, top: number, bottom: number): BBox => ({ x0, x1, top, bottom });

/** One row of cells between `top` and `bottom` with column lines at `xs`. */
const row = (xs: number[], top: number, bottom: number): BBox[] =>
  xs.slice(1).map((x1, i) => box(xs[i], x1, top, bottom));

describe('toBands', () => {
  it('cuts only where no cell crosses', () => {
    const cells = [box(0, 50, 0, 40), box(50, 100, 0, 20), box(50, 100, 20, 40), ...row([0, 50, 100], 40, 60)];
    expect(toBands(cells).map((b) => b.length)).toEqual([3, 2]);
  });
});

describe('innerColumnLines', () => {
  it('excludes the outer edges', () => {
    expect(innerColumnLines(row([10, 50, 90, 130], 0, 20))).toEqual([50, 90]);
  });
});

describe('splitByColumnLayout', () => {
  it('splits a form into a field box, an item table and a narrower totals box', () => {
    const fields = [...row([0, 100, 250, 400], 0, 20), ...row([0, 100, 250, 400], 20, 40)];
    const items = [...row([0, 40, 300, 400], 40, 60), ...row([0, 40, 300, 400], 60, 200)];
    const totals = row([250, 400], 200, 240);
    const groups = splitByColumnLayout([...fields, ...items, ...totals]);
    expect(groups.map((g) => g.length)).toEqual([6, 6, 1]);
  });

  it('keeps a merged header over its sub-columns', () => {
    const header = row([0, 100, 300], 0, 20); // "2008" spans two sub-columns
    const body = [...row([0, 100, 200, 300], 20, 40), ...row([0, 100, 200, 300], 40, 60)];
    expect(splitByColumnLayout([...header, ...body])).toHaveLength(1);
  });

  it('keeps full-width title and total rows with the table', () => {
    const cells = [
      box(0, 300, 0, 20),
      ...row([0, 100, 200, 300], 20, 40),
      ...row([0, 100, 200, 300], 40, 60),
      box(0, 300, 60, 80),
    ];
    expect(splitByColumnLayout(cells)).toHaveLength(1);
  });

  it('does not let a full-width row bridge two different layouts', () => {
    const cells = [...row([0, 100, 300], 0, 20), box(0, 300, 20, 40), ...row([0, 50, 300], 40, 60)];
    expect(splitByColumnLayout(cells).map((g) => g.length)).toEqual([3, 2]);
  });
});
