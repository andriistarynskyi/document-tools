import { describe, expect, it } from 'vitest';
import { toDocTable } from '../../../src/core/document/doc-table';
import { mapColumns, stitchTables } from '../../../src/core/document/stitch';
import { gridTable } from '../../helpers/synthetic-doc';

const XS = [50, 150, 250, 350];
const HEADER = ['Item', 'Qty', 'Total'];
const part = (page: number, rows: string[][], xs = XS, top = 100) => toDocTable(gridTable(page, rows, xs, top));

describe('mapColumns', () => {
  it('maps columns by x position', () => {
    expect(mapColumns(part(2, [['a', 'b', 'c']]).columns, part(1, [['a', 'b', 'c']]).columns)).toEqual([0, 1, 2]);
  });

  it('maps a split-off column onto the column it belongs to', () => {
    // Page 2 has an extra narrow column (a flag) inside the last column of page 1.
    const next = part(2, [['a', 'b', 'PF', '10']], [50, 150, 250, 270, 350]);
    expect(mapColumns(next.columns, part(1, [['a', 'b', 'c']]).columns)).toEqual([0, 1, 2, 2]);
  });

  it('returns null when a column has no counterpart', () => {
    expect(mapColumns(part(2, [['a', 'b']], [400, 500, 600]).columns, part(1, [['a', 'b', 'c']]).columns)).toBeNull();
  });
});

describe('stitchTables', () => {
  it('joins a continuation on the next page and drops its repeated header', () => {
    const [table] = stitchTables([
      part(1, [HEADER, ['Bolt', '1', '10']]),
      part(2, [HEADER, ['Nut', '2', '20']]),
    ]);
    expect(table.rows).toEqual([HEADER, ['Bolt', '1', '10'], ['Nut', '2', '20']]);
    expect(table.pages).toEqual([1, 2]);
  });

  it('joins a continuation without a repeated header', () => {
    const tables = stitchTables([part(1, [HEADER, ['Bolt', '1', '10']]), part(2, [['Nut', '2', '20']])]);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(3);
  });

  it('merges a split-off column into the original column', () => {
    const [table] = stitchTables([
      part(1, [HEADER, ['Bolt', '1', 'PF10']]),
      part(2, [['Nut', '2', 'PF', '20']], [50, 150, 250, 270, 350]),
    ]);
    expect(table.rows[2]).toEqual(['Nut', '2', 'PF 20']);
  });

  it('appends wrapped text carried over from the previous page', () => {
    const header = ['Line', 'Description', 'Total'];
    const [table] = stitchTables([
      part(1, [header, ['1', 'Valve, low', '10']]),
      part(2, [header, ['', 'pressure', ''], ['2', 'Nut', '20']]),
    ]);
    expect(table.rows).toEqual([header, ['1', 'Valve, low\npressure', '10'], ['2', 'Nut', '20']]);
  });

  it('keeps a first-column row at the top of the next page (likely a row label)', () => {
    const [table] = stitchTables([part(1, [HEADER, ['Bolt', '1', '10']]), part(2, [['Fasteners', '', '']])]);
    expect(table.rows[2]).toEqual(['Fasteners', '', '']);
  });

  it('does not join when something else sits between the parts', () => {
    const tables = stitchTables(
      [part(1, [HEADER, ['Bolt', '1', '10']]), part(2, [HEADER, ['Nut', '2', '20']])],
      () => false,
    );
    expect(tables).toHaveLength(2);
  });

  it('does not join tables on non-adjacent pages', () => {
    expect(stitchTables([part(1, [HEADER]), part(3, [HEADER])])).toHaveLength(2);
  });

  it('does not join tables on the same page', () => {
    expect(stitchTables([part(1, [HEADER], XS, 100), part(1, [HEADER], XS, 400)])).toHaveLength(2);
  });

  it('does not join tables whose columns do not line up', () => {
    expect(stitchTables([part(1, [HEADER]), part(2, [['a', 'b']], [300, 450, 600])])).toHaveLength(2);
  });

  it('shifts merged cells of the continuation below the existing rows', () => {
    const next = part(2, [HEADER, ['Group', '', ''], ['x', '1', '2']]);
    next.merges.push({ row: 1, col: 0, rowSpan: 1, colSpan: 3 });
    const [table] = stitchTables([part(1, [HEADER, ['Bolt', '1', '10']]), next]);
    expect(table.merges).toEqual([{ row: 2, col: 0, rowSpan: 1, colSpan: 3 }]);
  });
});
