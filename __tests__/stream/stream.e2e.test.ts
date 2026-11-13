import { describe, expect, it } from 'vitest';
import { findTables } from '../../src/core/detect/find-tables';
import { drawLinedTable, makePdf, readAllPages, type Canvas } from '../helpers/make-pdf';

async function tablesOn(draw: (c: Canvas) => void, mode?: Parameters<typeof findTables>[1]) {
  const [page] = await readAllPages(await makePdf([draw]));
  return findTables(page, mode);
}

const COLS = [50, 230, 330, 430];

function drawInvoice(c: Canvas, top: number): void {
  const rows = [
    ['Product', 'Qty', 'Unit Price', 'Total'],
    ['Hex bolt M8', '12', '0.45', '5.40'],
    ['Washer M8', '100', '0.02', '2.00'],
    ['Lock nut M8', '12', '0.30', '3.60'],
  ];
  rows.forEach((row, r) => row.forEach((t, k) => c.text(t, COLS[k], top + r * 18)));
}

describe('borderless tables end to end (generated PDFs)', () => {
  it('extracts a whitespace-aligned table', async () => {
    const [table] = await tablesOn((c) => drawInvoice(c, 100));
    expect(table.rows).toEqual([
      ['Product', 'Qty', 'Unit Price', 'Total'],
      ['Hex bolt M8', '12', '0.45', '5.40'],
      ['Washer M8', '100', '0.02', '2.00'],
      ['Lock nut M8', '12', '0.30', '3.60'],
    ]);
  });

  it('keeps wrapped descriptions in their row', async () => {
    const [table] = await tablesOn((c) => {
      ['Product', 'Qty', 'Unit Price', 'Total'].forEach((t, k) => c.text(t, COLS[k], 100));
      ['Valve 3in', '2', '120.00', '240.00'].forEach((t, k) => c.text(t, COLS[k], 125));
      c.text('butterfly, low pressure', 50, 137);
      ['Gasket', '4', '3.00', '12.00'].forEach((t, k) => c.text(t, COLS[k], 160));
    });
    expect(table.rows).toEqual([
      ['Product', 'Qty', 'Unit Price', 'Total'],
      ['Valve 3in\nbutterfly, low pressure', '2', '120.00', '240.00'],
      ['Gasket', '4', '3.00', '12.00'],
    ]);
  });

  it('does not treat paragraphs as a table', async () => {
    const tables = await tablesOn((c) => {
      const prose = 'This quotation is valid for thirty days from the date shown above.';
      for (let i = 0; i < 6; i++) c.text(prose, 50, 100 + i * 12);
    });
    expect(tables).toEqual([]);
  });

  it('ignores an address block above the table', async () => {
    const tables = await tablesOn((c) => {
      c.text('Ship To:', 50, 60);
      c.text('ACME MINING CORPORATION, 400 KM NORTH ROAD', 100, 60);
      drawInvoice(c, 100);
    });
    expect(tables).toHaveLength(1);
    expect(tables[0].rows[0]).toEqual(['Product', 'Qty', 'Unit Price', 'Total']);
  });

  it('finds ruled and borderless tables on the same page without duplicates', async () => {
    const tables = await tablesOn((c) => {
      drawLinedTable(c, [50, 200, 350], [60, 80, 100], [['Order', '42'], ['Date', '2026-11-12']]);
      drawInvoice(c, 160);
    });
    expect(tables.map((t) => t.rows[0])).toEqual([
      ['Order', '42'],
      ['Product', 'Qty', 'Unit Price', 'Total'],
    ]);
  });

  it('honours the detection mode', async () => {
    const draw = (c: Canvas) => {
      drawLinedTable(c, [50, 200, 350], [60, 80, 100], [['Order', '42'], ['Date', '2026-11-12']]);
      drawInvoice(c, 160);
    };
    expect(await tablesOn(draw, 'lattice')).toHaveLength(1);
    const streamOnly = await tablesOn(draw, 'stream');
    expect(streamOnly.some((t) => t.rows[0][0] === 'Product')).toBe(true);
  });
});
