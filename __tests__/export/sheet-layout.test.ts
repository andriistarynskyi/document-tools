import { describe, expect, it } from 'vitest';
import type { DocTable } from '../../src/core/document/doc-table';
import type { DocumentResult } from '../../src/core/document/document';
import { assembleSheet, toBlocks } from '../../src/export/sheet-layout';

function docTable(rows: string[][], pages = [1], merges: DocTable['merges'] = []): DocTable {
  return { pages, rows, merges, columns: [], top: 0, bottom: 0 };
}

const DOC: DocumentResult = {
  pageCount: 2,
  header: [['ACME Ltd'], ['Quote', '42']],
  footer: [['Page 2 of 2']],
  tables: [
    docTable([['Item', 'Qty'], ['Bolt', '1']], [1, 2]),
    docTable([['Group', ''], ['a', 'b']], [2], [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }]),
  ],
};

describe('toBlocks', () => {
  it('orders header, tables, footer and titles tables with pages and size', () => {
    const blocks = toBlocks(DOC);
    expect(blocks.map((b) => b.id)).toEqual(['header', 'table-1', 'table-2', 'footer']);
    expect(blocks[1].title).toBe('Table 1 · pages 1–2 · 2 × 2');
    expect(blocks[2].title).toBe('Table 2 · page 2 · 2 × 2');
  });

  it('drops merges that overlap an earlier one, so the export cannot fail on them', () => {
    const doc = {
      ...DOC,
      tables: [docTable([['a', ''], ['', '']], [1], [
        { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
        { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      ])],
    };
    const table = toBlocks(doc).find((b) => b.kind === 'table');
    expect(table?.merges).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }]);
  });

  it('omits an empty header and footer', () => {
    const blocks = toBlocks({ ...DOC, header: [], footer: [] });
    expect(blocks.map((b) => b.kind)).toEqual(['table', 'table']);
  });
});

describe('assembleSheet', () => {
  it('stacks blocks with one blank row between them', () => {
    const sheet = assembleSheet(toBlocks(DOC));
    expect(sheet.rows).toEqual([
      ['ACME Ltd'], ['Quote', '42'], [],
      ['Item', 'Qty'], ['Bolt', '1'], [],
      ['Group', ''], ['a', 'b'], [],
      ['Page 2 of 2'],
    ]);
  });

  it('offsets merges and bold header rows to sheet coordinates', () => {
    const sheet = assembleSheet(toBlocks(DOC));
    expect(sheet.merges).toEqual([{ top: 6, left: 0, bottom: 6, right: 1 }]);
    expect(sheet.boldRows).toEqual([3, 6]);
    expect(sheet.columnCount).toBe(2);
  });

  it('handles an empty block list', () => {
    expect(assembleSheet([])).toEqual({ rows: [], merges: [], boldRows: [], columnCount: 0 });
  });
});
