import { describe, expect, it } from 'vitest';
import { buildDocument } from '../../src/core/document/document';
import { summarizePage } from '../../src/core/document/page-summary';
import { drawLinedTable, makePdf, readAllPages, type Canvas } from '../helpers/make-pdf';

const COLS = [50, 250, 350, 450];
const HEADER = ['Product', 'Qty', 'Unit Price', 'Total'];

async function documentOf(pages: Array<(c: Canvas) => void>) {
  const contents = await readAllPages(await makePdf(pages));
  return buildDocument(contents.map((p) => summarizePage(p)));
}

function furniture(c: Canvas, page: number, total: number): void {
  c.text('ACME Supplies Ltd - Price List', 50, 30, 12);
  c.text(`Page ${page} of ${total}`, 50, 760);
}

function row(c: Canvas, cells: string[], top: number): void {
  cells.forEach((t, k) => c.text(t, COLS[k], top));
}

const items = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => [`Item ${from + i}`, String(from + i), '1.00', `${from + i}.00`]);

/** One page of a borderless price list: repeated header, then the given item rows. */
const priceListPage = (page: number, total: number, rows: string[][]) => (c: Canvas) => {
  furniture(c, page, total);
  row(c, HEADER, 80);
  rows.forEach((r, i) => row(c, r, 105 + i * 18));
};

describe('document assembly end to end (generated PDFs)', () => {
  it('writes a running header and footer once and joins a table across three pages', async () => {
    const doc = await documentOf([
      priceListPage(1, 3, items(1, 4)),
      priceListPage(2, 3, items(5, 8)),
      priceListPage(3, 3, items(9, 10)),
    ]);
    expect(doc.header).toEqual([['ACME Supplies Ltd - Price List']]);
    expect(doc.footer).toEqual([['Page 3 of 3']]);
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].pages).toEqual([1, 2, 3]);
    expect(doc.tables[0].rows).toEqual([HEADER, ...items(1, 10)]);
  });

  it('keeps separate tables apart when other text sits between them', async () => {
    const doc = await documentOf([
      priceListPage(1, 2, items(1, 3)),
      (c) => {
        furniture(c, 2, 2);
        c.text('Section B: discontinued products', 50, 60);
        row(c, HEADER, 80);
        items(4, 6).forEach((r, i) => row(c, r, 105 + i * 18));
      },
    ]);
    expect(doc.tables).toHaveLength(2);
    expect(doc.tables.map((t) => t.pages)).toEqual([[1], [2]]);
  });

  it('joins a ruled table that continues on the next page', async () => {
    const xs = [50, 200, 350];
    const doc = await documentOf([
      (c) => drawLinedTable(c, xs, [600, 625, 650, 675], [['Code', 'Name'], ['A1', 'Alpha'], ['B2', 'Beta']]),
      (c) => drawLinedTable(c, xs, [60, 85, 110], [['C3', 'Gamma'], ['D4', 'Delta']]),
    ]);
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].rows).toEqual([['Code', 'Name'], ['A1', 'Alpha'], ['B2', 'Beta'], ['C3', 'Gamma'], ['D4', 'Delta']]);
  });

  it('has no header or footer for a single page', async () => {
    const doc = await documentOf([priceListPage(1, 1, items(1, 2))]);
    expect(doc.header).toEqual([]);
    expect(doc.footer).toEqual([]);
    expect(doc.tables).toHaveLength(1);
  });
});
