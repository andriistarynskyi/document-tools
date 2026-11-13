import { describe, expect, it } from 'vitest';
import { findTables } from '../../src/core/detect/find-tables';
import { makePdf, readAllPages, type Canvas } from '../helpers/make-pdf';

/** Borders drawn the way many form generators do: thin filled rectangles. */
const hBar = (c: Canvas, x0: number, x1: number, top: number) => c.fill(x0, top, x1 - x0, 1);
const vBar = (c: Canvas, x: number, top: number, bottom: number) => c.fill(x, top, 1, bottom - top);

const FIELD_XS = [50, 200, 350, 500];
const ITEM_XS = [50, 90, 300, 400, 500];

/** A quote form: a field box and an item table sharing one border; item rows not ruled. */
function drawForm(c: Canvas): void {
  c.fill(201, 101, 148, 18, 0.85); // shading behind a field label: must not become a border
  for (const y of [100, 120, 140]) hBar(c, 50, 500, y);
  FIELD_XS.forEach((x) => vBar(c, x, 100, 140));
  [['DATE', 'WRITER', 'BRANCH'], ['10/19/2026', 'KRI', '0069']].forEach((r, i) =>
    r.forEach((t, k) => c.text(t, FIELD_XS[k] + 4, 104 + i * 20)));

  hBar(c, 50, 500, 160);
  hBar(c, 50, 500, 300);
  ITEM_XS.forEach((x) => vBar(c, x, 140, 300));
  ['LINE', 'DESCRIPTION', 'QTY', 'AMOUNT'].forEach((t, k) => c.text(t, ITEM_XS[k] + 4, 145));
  [['1', 'Valve 3in', '30', '11428.20'], ['2', 'Gasket', '4', '12.00']].forEach((r, i) =>
    r.forEach((t, k) => c.text(t, ITEM_XS[k] + 4, 170 + i * 30)));
  c.text('butterfly, low pressure', ITEM_XS[1] + 4, 182);
}

describe('ruled forms end to end (generated PDF)', () => {
  it('splits one bordered form into a field table and an item table', async () => {
    const [page] = await readAllPages(await makePdf([drawForm]));
    const tables = findTables(page);
    expect(tables.map((t) => t.rows[0])).toEqual([
      ['DATE', 'WRITER', 'BRANCH'],
      ['LINE', 'DESCRIPTION', 'QTY', 'AMOUNT'],
    ]);
  });

  it('gives each item its own row when only the columns are ruled', async () => {
    const [page] = await readAllPages(await makePdf([drawForm]));
    const items = findTables(page)[1];
    expect(items.rows).toEqual([
      ['LINE', 'DESCRIPTION', 'QTY', 'AMOUNT'],
      ['1', 'Valve 3in\nbutterfly, low pressure', '30', '11428.20'],
      ['2', 'Gasket', '4', '12.00'],
    ]);
  });

  it('ignores shading, so it adds no extra columns', async () => {
    const [page] = await readAllPages(await makePdf([drawForm]));
    expect(findTables(page)[0].colCount).toBe(3);
  });
});
