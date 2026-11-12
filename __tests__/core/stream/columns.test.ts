import { describe, expect, it } from 'vitest';
import { columnOf, findColumnBoundaries } from '../../../src/core/stream/columns';
import { textLines } from '../../helpers/synthetic-lines';

describe('findColumnBoundaries', () => {
  it('places one boundary in each gap shared by all lines', () => {
    const lines = textLines([
      [[50, 'Item'], [200, 'Qty'], [300, 'Price']],
      [[50, 'Bolt'], [200, '12'], [300, '4.50']],
    ]);
    const b = findColumnBoundaries(lines);
    expect(b).toHaveLength(2);
    expect(b[0]).toBeGreaterThan(70);
    expect(b[0]).toBeLessThan(200);
    expect(b[1]).toBeGreaterThan(215);
    expect(b[1]).toBeLessThan(300);
  });

  it('does not split a long multi-word cell at its word gaps', () => {
    const lines = textLines([
      [[50, 'Item'], [200, 'Qty']],
      [[50, 'A very long description'], [200, '3']],
    ]);
    // The description (50..165) has word gaps that line up with the empty space after "Item",
    // but only one line touches them. The real column gap is 165..200.
    const b = findColumnBoundaries(lines);
    expect(b).toHaveLength(1);
    expect(b[0]).toBeGreaterThan(165);
    expect(b[0]).toBeLessThan(200);
  });

  it('accepts a narrow gap when many rows align to it (right-aligned numbers)', () => {
    // Values right-aligned at x=200 and a flag starting at x=202 on every row.
    const rows = ['1.00', '22.00', '333.00'].map((v): Array<[number, string]> => [
      [50, 'x'], [200 - v.length * 5, v], [202, 'PF'],
    ]);
    const header: Array<[number, string]> = [[50, 'Item'], [175, 'Price'], [260, 'Flag']];
    const lines = textLines([header, ...rows]);
    expect(findColumnBoundaries(lines).some((b) => b > 200 && b < 202)).toBe(true);
  });

  it('ignores aligned word spacing that is never a real segment break', () => {
    // Two lines of prose whose single-space gaps happen to align.
    const lines = textLines([
      [[50, 'aaaa bbbb'], [200, 'x']],
      [[50, 'cccc dddd'], [200, 'y']],
    ]);
    expect(findColumnBoundaries(lines)).toHaveLength(1);
  });

  it('keeps a column that only the header fills', () => {
    const lines = textLines([
      [[50, 'Item'], [150, 'Discount'], [300, 'Total']],
      [[50, 'Bolt'], [300, '10']],
      [[50, 'Nut'], [300, '20']],
    ]);
    expect(findColumnBoundaries(lines)).toHaveLength(2);
  });

  it('returns nothing for no lines', () => {
    expect(findColumnBoundaries([])).toEqual([]);
  });
});

describe('columnOf', () => {
  it('maps x positions to column indexes', () => {
    expect([10, 150, 250, 400].map((x) => columnOf(x, [100, 200, 300]))).toEqual([0, 1, 2, 3]);
  });
});
