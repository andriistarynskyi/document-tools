import { describe, expect, it } from 'vitest';
import { findLatticeTables } from '../../src/core/lattice/lattice';
import { drawLinedTable, makePdf, readAllPages } from '../helpers/make-pdf';

const XS = [50, 200, 350];
const YS = [100, 125, 150, 175];
const ROWS = [['Item', 'Qty'], ['Bolt', '12'], ['Nut', '7']];

async function tablesOnPage(draw: Parameters<typeof makePdf>[0][number]) {
  const [content] = await readAllPages(await makePdf([draw]));
  return findLatticeTables(content);
}

describe('lattice end to end (generated PDFs)', () => {
  it('reads a table drawn with separate lines', async () => {
    const [table] = await tablesOnPage((c) => drawLinedTable(c, XS, YS, ROWS));
    expect(table.rows).toEqual(ROWS);
  });

  it('reads a table drawn as individual bordered rectangles', async () => {
    const [table] = await tablesOnPage((c) => {
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 2; k++) {
          c.rect(XS[k], YS[r], XS[k + 1] - XS[k], YS[r + 1] - YS[r]);
          c.text(ROWS[r][k], XS[k] + 4, YS[r] + 5);
        }
      }
    });
    expect(table.rows).toEqual(ROWS);
  });

  it('detects a merged header cell as a colSpan', async () => {
    const [table] = await tablesOnPage((c) => {
      c.line(50, 100, 350, 100);
      c.line(50, 125, 350, 125);
      c.line(50, 150, 350, 150);
      c.line(50, 100, 50, 150);
      c.line(350, 100, 350, 150);
      c.line(200, 125, 200, 150); // divider only below the header
      c.text('Summary', 54, 105);
      c.text('A', 54, 130);
      c.text('B', 204, 130);
    });
    const header = table.cells.find((cell) => cell.text === 'Summary');
    expect(header).toMatchObject({ row: 0, col: 0, colSpan: 2 });
    expect(table.rows[1]).toEqual(['A', 'B']);
  });

  it('separates two tables on the same page', async () => {
    const tables = await tablesOnPage((c) => {
      drawLinedTable(c, XS, YS, ROWS);
      drawLinedTable(c, XS, [400, 425, 450], [['H1', 'H2'], ['x', 'y']]);
    });
    expect(tables.map((t) => t.rows[0])).toEqual([['Item', 'Qty'], ['H1', 'H2']]);
  });

  it('keeps wrapped cell text together', async () => {
    const [table] = await tablesOnPage((c) => {
      drawLinedTable(c, [50, 200, 350], [100, 140, 165], [['', ''], ['x', 'y']]);
      c.text('first line', 54, 105);
      c.text('second line', 54, 118);
    });
    expect(table.rows[0][0]).toBe('first line\nsecond line');
  });

  it('finds nothing on a page with only text', async () => {
    const tables = await tablesOnPage((c) => c.text('Just a paragraph of prose.', 50, 100));
    expect(tables).toEqual([]);
  });
});
