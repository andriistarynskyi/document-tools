import { describe, expect, it } from 'vitest';
import { findBlocks } from '../../../src/core/stream/blocks';
import { textLines } from '../../helpers/synthetic-lines';

const firstWords = (lines: ReturnType<typeof textLines>) => lines.map((l) => l.words[0].text);

describe('findBlocks', () => {
  it('collects consecutive tabular lines into one block', () => {
    const lines = textLines([
      [[50, 'Item'], [200, 'Qty']],
      [[50, 'Bolt'], [200, '12']],
      [[50, 'Nut'], [200, '7']],
    ]);
    expect(findBlocks(lines).map(firstWords)).toEqual([['Item', 'Bolt', 'Nut']]);
  });

  it('ignores prose', () => {
    expect(findBlocks(textLines([[[50, 'Some prose']], [[50, 'More prose']]]))).toEqual([]);
  });

  it('needs at least two tabular lines', () => {
    expect(findBlocks(textLines([[[50, 'Lonely'], [200, 'line']]]))).toEqual([]);
  });

  it('splits blocks at a large vertical gap', () => {
    const top = textLines([[[50, 'A'], [200, '1']], [[50, 'B'], [200, '2']]], 100);
    const bottom = textLines([[[50, 'C'], [200, '3']], [[50, 'D'], [200, '4']]], 400);
    expect(findBlocks([...top, ...bottom]).map(firstWords)).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('drops an address-like line above the header whose words cut across columns', () => {
    const lines = textLines([
      [[50, 'Ship To:'], [100, 'ACME MINING CORPORATION LTD']],
      [[50, 'Line'], [100, 'Product'], [250, 'Qty'], [330, 'Price']],
      [[50, '1'], [100, 'BOLT'], [250, '12'], [330, '4.50']],
      [[50, '2'], [100, 'NUT'], [250, '7'], [330, '1.25']],
    ]);
    expect(findBlocks(lines).map(firstWords)).toEqual([['Line', '1', '2']]);
  });

  it('keeps a loose note between the header and the first row', () => {
    const lines = [
      ...textLines([[[50, 'Line'], [200, 'Qty']]], 100),
      ...textLines([[[60, 'continued note']]], 140),
      ...textLines([[[50, '1'], [200, '12']], [[50, '2'], [200, '7']]], 170),
    ];
    expect(findBlocks(lines).map(firstWords)).toEqual([['Line', 'continued', '1', '2']]);
  });
});
