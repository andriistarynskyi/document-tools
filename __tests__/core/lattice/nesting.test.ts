import { describe, expect, it } from 'vitest';
import type { BBox } from '../../../src/core/geometry/types';
import { buildTables } from '../../../src/core/lattice/nesting';
import { textChars } from '../../helpers/synthetic-page';

const box = (x0: number, x1: number, top: number, bottom: number): BBox => ({ x0, x1, top, bottom });

// Outer table: a header row and one big cell (300..500 x 120..200) that holds a nested box.
const OUTER = [box(100, 300, 100, 120), box(300, 500, 100, 120), box(100, 300, 120, 200), box(300, 500, 120, 200)];

describe('buildTables (nested boxes)', () => {
  it('drops a label-only box inside a cell and keeps its text in the outer cell', () => {
    const labels = [box(310, 380, 130, 145), box(310, 380, 145, 160)];
    const chars = [
      ...textChars('Totals', 305, 105),
      ...textChars('SUB', 315, 132), ...textChars('10.00', 420, 132),
      ...textChars('TAX', 315, 147), ...textChars('0.50', 420, 147),
    ];
    const tables = buildTables(1, [OUTER, labels], chars);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows[1][1]).toBe('SUB 10.00\nTAX 0.50');
  });

  it('keeps a real nested table and removes its text from the outer cell', () => {
    const inner = [box(310, 380, 130, 145), box(380, 450, 130, 145), box(310, 380, 145, 160), box(380, 450, 145, 160)];
    const chars = [
      ...textChars('A', 315, 132), ...textChars('1', 385, 132),
      ...textChars('B', 315, 147), ...textChars('2', 385, 147),
      ...textChars('note', 460, 180),
    ];
    const tables = buildTables(1, [OUTER, inner], chars);
    expect(tables).toHaveLength(2);
    const [outer, nested] = tables;
    expect(nested.rows).toEqual([['A', '1'], ['B', '2']]);
    expect(outer.rows[1][1]).toBe('note');
  });
});
