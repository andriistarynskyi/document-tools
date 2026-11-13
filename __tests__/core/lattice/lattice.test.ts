import { describe, expect, it } from 'vitest';
import { gridEdges, hEdge, page, textChars, vEdge } from '../../helpers/synthetic-page';
import { findLatticeTables } from '../../../src/core/lattice/lattice';

describe('findLatticeTables', () => {
  it('extracts a fully ruled 3x2 table with cell text', () => {
    const edges = gridEdges([50, 150, 250], [100, 120, 140, 160]);
    const chars = [
      ...textChars('Item', 55, 105), ...textChars('Qty', 155, 105),
      ...textChars('Bolt', 55, 125), ...textChars('12', 155, 125),
      ...textChars('Nut', 55, 145), ...textChars('7', 155, 145),
    ];
    const [table] = findLatticeTables(page(edges, chars));
    expect(table.rows).toEqual([['Item', 'Qty'], ['Bolt', '12'], ['Nut', '7']]);
    expect(table.rowCount).toBe(3);
    expect(table.colCount).toBe(2);
  });

  it('reports a merged cell as a colSpan', () => {
    // Header row spans both columns; the divider only exists in the body rows.
    const edges = [
      vEdge(50, 100, 160), vEdge(250, 100, 160), vEdge(150, 120, 160),
      hEdge(50, 250, 100), hEdge(50, 250, 120), hEdge(50, 250, 140), hEdge(50, 250, 160),
    ];
    const chars = [...textChars('Title', 55, 105), ...textChars('A', 55, 125), ...textChars('B', 155, 125)];
    const [table] = findLatticeTables(page(edges, chars));
    const title = table.cells.find((c) => c.text === 'Title');
    expect(title).toMatchObject({ row: 0, col: 0, colSpan: 2, rowSpan: 1 });
    expect(table.rows[0]).toEqual(['Title', '']);
    expect(table.rows[1]).toEqual(['A', 'B']);
  });

  it('reports a rowSpan for a tall merged cell', () => {
    const edges = [
      hEdge(50, 250, 100), hEdge(150, 250, 120), hEdge(50, 250, 140),
      vEdge(50, 100, 140), vEdge(150, 100, 140), vEdge(250, 100, 140),
    ];
    const chars = textChars('Group', 55, 115);
    const [table] = findLatticeTables(page(edges, chars));
    const group = table.cells.find((c) => c.text === 'Group');
    expect(group).toMatchObject({ row: 0, col: 0, rowSpan: 2, colSpan: 1 });
  });

  it('joins multi-line cell text with a newline', () => {
    const edges = gridEdges([50, 150, 250], [100, 140]);
    const chars = [...textChars('first', 55, 102), ...textChars('second', 55, 118)];
    const [table] = findLatticeTables(page(edges, chars));
    expect(table.rows[0][0]).toBe('first\nsecond');
  });

  it('does not report overlapping cells when an inner border is only partly drawn', () => {
    // Outer 2x2 box; the middle horizontal line spans only the right column and the middle
    // vertical line only the bottom row, which lets the cell search find overlapping boxes.
    const edges = [
      hEdge(50, 250, 100), hEdge(50, 250, 140), hEdge(150, 250, 120), hEdge(50, 250, 120.5),
      vEdge(50, 100, 140), vEdge(250, 100, 140), vEdge(150, 120, 140),
    ];
    const chars = [...textChars('Top', 55, 105), ...textChars('L', 55, 125), ...textChars('R', 155, 125)];
    const [table] = findLatticeTables(page(edges, chars));
    const covered = new Set<string>();
    for (const c of table.cells) {
      for (let r = c.row; r < c.row + c.rowSpan; r++) {
        for (let k = c.col; k < c.col + c.colSpan; k++) {
          expect(covered.has(`${r},${k}`)).toBe(false);
          covered.add(`${r},${k}`);
        }
      }
    }
    expect(table.rows.flat().filter(Boolean).sort()).toEqual(['L', 'R', 'Top']);
  });

  it('returns separate tables in top-to-bottom order', () => {
    const edges = [...gridEdges([50, 150, 250], [400, 420, 440]), ...gridEdges([50, 150, 250], [100, 120, 140])];
    const tables = findLatticeTables(page(edges, []));
    expect(tables.map((t) => t.bbox.top)).toEqual([100, 400]);
  });

  it('tolerates slightly misaligned lines by snapping', () => {
    const edges = [
      ...gridEdges([50, 150, 250], [100, 120, 140]).filter((e) => !(e.orientation === 'h' && e.top === 120)),
      hEdge(50, 250, 121.5),
    ];
    const [table] = findLatticeTables(page(edges, []));
    expect(table.rowCount).toBe(2);
  });

  it('ignores stray short lines', () => {
    const edges = [...gridEdges([50, 150, 250], [100, 120, 140]), hEdge(300, 302, 500), vEdge(400, 0, 2)];
    expect(findLatticeTables(page(edges, []))).toHaveLength(1);
  });

  it('returns nothing for a page with no lines', () => {
    expect(findLatticeTables(page([], textChars('hello', 10, 10)))).toEqual([]);
  });
});
