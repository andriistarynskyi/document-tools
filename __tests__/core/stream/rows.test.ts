import { describe, expect, it } from 'vitest';
import { findColumnBoundaries } from '../../../src/core/stream/columns';
import { isTabularLine } from '../../../src/core/stream/lines';
import { assignRows } from '../../../src/core/stream/rows';
import { textLines } from '../../helpers/synthetic-lines';

const cellsOf = (rows: ReturnType<typeof assignRows>) => rows.map((r) => r.cells);

function rowsFor(rows: Parameters<typeof textLines>[0], pitch = 14) {
  const lines = textLines(rows, 100, pitch);
  return cellsOf(assignRows(lines, findColumnBoundaries(lines.filter(isTabularLine))));
}

describe('assignRows', () => {
  it('maps each tabular line to a row', () => {
    expect(rowsFor([
      [[50, 'Item'], [200, 'Qty']],
      [[50, 'Bolt'], [200, '12']],
    ])).toEqual([['Item', 'Qty'], ['Bolt', '12']]);
  });

  it('appends wrapped text to the cell it starts under', () => {
    expect(rowsFor([
      [[50, 'Item'], [200, 'Qty']],
      [[50, 'Bolt'], [200, '12']],
      [[60, 'stainless steel']],
    ])).toEqual([['Item', 'Qty'], ['Bolt\nstainless steel', '12']]);
  });

  it('merges a two-line header printed at tight pitch', () => {
    const lines = [
      ...textLines([[[50, 'Unit'], [200, 'Net']], [[50, 'Price'], [200, 'Total']]], 100, 10),
      ...textLines([[[50, '4.50'], [200, '9.00']], [[50, '1.25'], [200, '2.50']]], 130, 18),
    ];
    const rows = cellsOf(assignRows(lines, findColumnBoundaries(lines.filter(isTabularLine))));
    expect(rows).toEqual([['Unit Price', 'Net Total'], ['4.50', '9.00'], ['1.25', '2.50']]);
  });

  it('does not merge tightly printed totals that would stack two numbers in one cell', () => {
    const lines = [
      ...textLines([[[50, 'Item'], [200, 'Amount']], [[50, 'Bolt'], [200, '10.00']]], 100, 18),
      ...textLines([[[50, 'Subtotal'], [200, '10.00']], [[50, 'Tax'], [200, '0.50']]], 140, 10),
    ];
    const rows = cellsOf(assignRows(lines, findColumnBoundaries(lines.filter(isTabularLine))));
    expect(rows).toEqual([['Item', 'Amount'], ['Bolt', '10.00'], ['Subtotal', '10.00'], ['Tax', '0.50']]);
  });

  it('starts a row for a section label under an empty first cell', () => {
    expect(rowsFor([
      [[200, '2024'], [300, '2023']],
      [[50, 'Assets']],
      [[50, 'Cash'], [200, '10'], [300, '9']],
    ])).toEqual([['', '2024', '2023'], ['Assets', '', ''], ['Cash', '10', '9']]);
  });

  it('stops at prose under an empty cell (text after a totals row)', () => {
    expect(rowsFor([
      [[50, 'Item'], [300, 'Total']],
      [[50, 'Bolt'], [300, '10']],
      [[200, 'Subtotal'], [300, '10']],
      [[55, 'All taxes are extra and payable by the customer']],
    ])).toEqual([['Item', '', 'Total'], ['Bolt', '', '10'], ['', 'Subtotal', '10']]);
  });
});
