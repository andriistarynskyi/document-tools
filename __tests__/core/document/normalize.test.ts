import { describe, expect, it } from 'vitest';
import type { DocTable } from '../../../src/core/document/doc-table';
import { cleanText, normalizeTable } from '../../../src/core/document/normalize';

function table(rows: string[][], merges: DocTable['merges'] = []): DocTable {
  const columns = rows[0].map((_, i) => ({ x0: i * 100, x1: i * 100 + 100 }));
  return { pages: [1], rows, merges, columns, top: 0, bottom: 100 };
}

describe('cleanText', () => {
  it('collapses spaces and trims each line, keeping line breaks', () => {
    expect(cleanText('  Valve   3"  \n\n  low  pressure ')).toBe('Valve 3"\nlow pressure');
  });
});

describe('normalizeTable', () => {
  it('drops empty rows and columns', () => {
    const t = normalizeTable(table([
      ['Item', '', 'Qty'],
      ['', '', ''],
      ['Bolt', ' ', '2'],
    ]));
    expect(t.rows).toEqual([['Item', 'Qty'], ['Bolt', '2']]);
    expect(t.columns).toHaveLength(2);
  });

  it('shrinks merged cells that covered removed columns', () => {
    const t = normalizeTable(table([['Title', '', '', ''], ['a', '', 'b', 'c']], [{ row: 0, col: 0, rowSpan: 1, colSpan: 4 }]));
    expect(t.rows[0]).toEqual(['Title', '', '']);
    expect(t.merges).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 3 }]);
  });

  it('drops merges that shrink to a single cell', () => {
    const t = normalizeTable(table([['Title', ''], ['a', '']], [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }]));
    expect(t.merges).toEqual([]);
  });

  it('moves merges up when rows above are removed', () => {
    const t = normalizeTable(table([['', ''], ['Group', ''], ['a', 'b']], [{ row: 1, col: 0, rowSpan: 1, colSpan: 2 }]));
    expect(t.merges).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }]);
  });
});
