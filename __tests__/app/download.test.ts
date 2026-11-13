import { describe, expect, it } from 'vitest';
import { xlsxName } from '../../src/app/download';

describe('xlsxName', () => {
  it.each([
    ['Quote 123.pdf', 'Quote 123.xlsx'],
    ['scan.PDF', 'scan.xlsx'],
    ['.pdf', 'tables.xlsx'],
    ['report', 'report.xlsx'],
  ])('%s -> %s', (source, expected) => {
    expect(xlsxName(source)).toBe(expected);
  });
});
