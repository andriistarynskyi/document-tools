import { describe, expect, it } from 'vitest';
import { findTables } from '../../../src/core/detect/find-tables';
import { gridEdges, page, textChars } from '../../helpers/synthetic-page';

describe('findTables', () => {
  it('drops ruled boxes with a single column (label boxes)', () => {
    const edges = gridEdges([50, 150], [100, 120, 140]);
    const chars = [...textChars('PRICE', 55, 105), ...textChars('380.9', 55, 125)];
    expect(findTables(page(edges, chars), 'lattice')).toEqual([]);
  });

  it('returns tables in reading order', () => {
    const edges = [...gridEdges([50, 150, 250], [400, 420, 440]), ...gridEdges([50, 150, 250], [100, 120, 140])];
    expect(findTables(page(edges, [])).map((t) => t.bbox.top)).toEqual([100, 400]);
  });

  it('returns nothing for an empty page', () => {
    expect(findTables(page([], []))).toEqual([]);
  });
});
