import { describe, expect, it } from 'vitest';
import { resolveOverlaps, type Slot } from '../../../src/core/table/slots';

const slot = (row: number, col: number, rowSpan = 1, colSpan = 1): Slot => ({ row, col, rowSpan, colSpan });

/** Every grid position covered at most once. */
function isDisjoint(slots: Slot[]): boolean {
  const seen = new Set<string>();
  for (const s of slots) {
    for (let r = s.row; r < s.row + s.rowSpan; r++) {
      for (let c = s.col; c < s.col + s.colSpan; c++) {
        if (seen.has(`${r},${c}`)) return false;
        seen.add(`${r},${c}`);
      }
    }
  }
  return true;
}

describe('resolveOverlaps', () => {
  it('leaves disjoint cells untouched', () => {
    const cells = [slot(0, 0, 1, 2), slot(1, 0), slot(1, 1)];
    expect(resolveOverlaps(cells, 2, 2)).toEqual(cells);
  });

  it('keeps the smaller cell and splits what the larger one still covers', () => {
    // A 2x2 cell drawn over a 1x2 cell in its bottom row (a partly drawn border).
    const resolved = resolveOverlaps([slot(0, 0, 2, 2), slot(1, 0, 1, 2)], 2, 2);
    expect(resolved).toEqual([slot(0, 0, 1, 2), slot(1, 0, 1, 2)]);
  });

  it('never drops grid area that only the larger cell covered', () => {
    const resolved = resolveOverlaps([slot(0, 0, 3, 3), slot(1, 1)], 3, 3);
    expect(isDisjoint(resolved)).toBe(true);
    expect(resolved.reduce((n, s) => n + s.rowSpan * s.colSpan, 0)).toBe(9);
    expect(resolved).toContainEqual(slot(1, 1));
  });

  it('drops an exact duplicate', () => {
    expect(resolveOverlaps([slot(0, 0, 1, 2), slot(0, 0, 1, 2)], 1, 2)).toEqual([slot(0, 0, 1, 2)]);
  });

  it('returns cells in reading order', () => {
    const resolved = resolveOverlaps([slot(1, 1), slot(0, 1), slot(1, 0), slot(0, 0)], 2, 2);
    expect(resolved).toEqual([slot(0, 0), slot(0, 1), slot(1, 0), slot(1, 1)]);
  });
});
