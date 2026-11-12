import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findTables } from '../../src/core/detect/find-tables';
import type { ExtractedTable } from '../../src/core/table/table';
import { readAllPages } from '../helpers/make-pdf';

// testFiles/ is git-ignored; these regression checks run only where the sample PDFs exist.
const INVOICE = 'testFiles/17768124-00.pdf';
const SAMPLE = 'testFiles/sample-tables.pdf';

async function tablesPerPage(path: string): Promise<ExtractedTable[][]> {
  const pages = await readAllPages(new Uint8Array(readFileSync(path)));
  return pages.map((p) => findTables(p));
}

const itemTable = (tables: ExtractedTable[]) => tables.find((t) => t.rows[0][0].startsWith('Line'));

describe.skipIf(!existsSync(INVOICE))('17768124-00.pdf (borderless invoice)', () => {
  it('reads the page 1 line items with the printed header', async () => {
    const [page1] = await tablesPerPage(INVOICE);
    const table = itemTable(page1);
    expect(table?.rows[0]).toEqual([
      'Line #', 'Product And Description', 'Expected Ship Date', 'Qty', 'Qty UM',
      'Unit Price', 'Discount %', 'Net Unit Price', 'Total',
    ]);
    expect(table?.rows.slice(1).map((r) => r[0])).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(table?.rows[1].slice(2, 6)).toEqual(['TBD', '30', 'EACH', '408.46000']);
  });

  it('keeps wrapped descriptions inside their item', async () => {
    const [page1] = await tablesPerPage(INVOICE);
    const description = itemTable(page1)?.rows[1][1] ?? '';
    expect(description.split('\n')).toEqual(['//V030700STJ', 'VALVE BUTTERFLY 3"', '700S LOW-P']);
  });

  it('excludes the address block and the legal footer', async () => {
    const pages = await tablesPerPage(INVOICE);
    const text = pages.flat().flatMap((t) => t.rows.flat()).join(' ');
    expect(text).not.toContain('CAMBRIDGE BAY');
    expect(text).not.toContain('All applicable taxes');
  });

  it('includes the totals on page 2', async () => {
    const [, page2] = await tablesPerPage(INVOICE);
    const rows = itemTable(page2)?.rows ?? [];
    const last = rows[rows.length - 1] ?? [];
    expect(last.filter(Boolean)).toEqual(['Total', '23,045.38']);
  });
});

describe.skipIf(!existsSync(SAMPLE))('sample-tables.pdf (ruled tables)', () => {
  it('does not add borderless duplicates of ruled tables', async () => {
    const pages = await tablesPerPage(SAMPLE);
    expect(pages.slice(0, 5).map((p) => p.length)).toEqual([3, 3, 3, 2, 4]);
  });
});
