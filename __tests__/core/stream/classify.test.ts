import { describe, expect, it } from 'vitest';
import { isLikelyTable } from '../../../src/core/stream/classify';

describe('isLikelyTable', () => {
  it('accepts a dense multi-column grid', () => {
    expect(isLikelyTable([['Item', 'Qty', 'Price'], ['Bolt', '12', '4.50'], ['Nut', '7', '1.25']])).toBe(true);
  });

  it('accepts a two-column table with a numeric column', () => {
    expect(isLikelyTable([['Region', 'Sales'], ['North', '1,200'], ['South', '980']])).toBe(true);
  });

  it('rejects two-column text without numbers (address blocks, key/value prose)', () => {
    expect(isLikelyTable([['Bill to', 'Ship to'], ['ACME Ltd', 'ACME Warehouse'], ['Main St', 'Dock Rd']])).toBe(false);
  });

  it('rejects a single row', () => {
    expect(isLikelyTable([['a', 'b', 'c']])).toBe(false);
  });

  it('rejects very sparse grids', () => {
    expect(isLikelyTable([['a', '', '', ''], ['', '', '', 'b'], ['', 'c', '', '']])).toBe(false);
  });
});
