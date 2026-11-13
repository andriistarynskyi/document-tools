import { describe, expect, it } from 'vitest';
import type { BBox } from '../../../src/core/geometry/types';
import { splitTextRows } from '../../../src/core/lattice/text-rows';
import { textChars } from '../../helpers/synthetic-page';

const box = (x0: number, x1: number, top: number, bottom: number): BBox => ({ x0, x1, top, bottom });
const XS = [50, 150, 250, 350];
/** Every column is one tall cell (columns ruled, rows not). */
const tallColumns = (top: number, bottom: number) => XS.slice(1).map((x1, i) => box(XS[i], x1, top, bottom));

const rowTops = (cells: BBox[]) => [...new Set(cells.map((c) => c.top))].sort((a, b) => a - b);

describe('splitTextRows', () => {
  it('splits ruled columns without row lines into one row per record', () => {
    const chars = [
      ...textChars('Bolt', 55, 105), ...textChars('12', 155, 105), ...textChars('4.50', 255, 105),
      ...textChars('Nut', 55, 125), ...textChars('7', 155, 125), ...textChars('1.25', 255, 125),
      ...textChars('Washer', 55, 145), ...textChars('100', 155, 145), ...textChars('0.02', 255, 145),
    ];
    const cells = splitTextRows(tallColumns(100, 200), chars);
    expect(cells).toHaveLength(9);
    expect(rowTops(cells)).toHaveLength(3);
  });

  it('keeps wrapped text that fills one column inside its record', () => {
    const chars = [
      ...textChars('Valve 3in', 55, 105), ...textChars('2', 155, 105), ...textChars('240.00', 255, 105),
      ...textChars('butterfly', 55, 117), // wrapped description
      ...textChars('Gasket', 55, 135), ...textChars('4', 155, 135), ...textChars('12.00', 255, 135),
    ];
    expect(rowTops(splitTextRows(tallColumns(100, 200), chars))).toHaveLength(2);
  });

  it('does not split tightly wrapped text that spans several columns', () => {
    const chars = [
      ...textChars('first', 55, 105), ...textChars('first', 155, 105),
      ...textChars('second', 55, 116), ...textChars('second', 155, 116),
    ];
    expect(splitTextRows(tallColumns(100, 140), chars)).toHaveLength(3);
  });

  it('does not cut a merged cell at the row lines that already exist', () => {
    // A group label spans two ruled rows; the other columns have their own row line.
    const cells = [box(50, 150, 100, 140), box(150, 250, 100, 120), box(150, 250, 120, 140)];
    const chars = [
      ...textChars('Group', 55, 101), ...textChars('a', 155, 101),
      ...textChars('b', 155, 121), ...textChars('x', 60, 121),
    ];
    expect(splitTextRows(cells, chars)).toEqual(cells);
  });
});
