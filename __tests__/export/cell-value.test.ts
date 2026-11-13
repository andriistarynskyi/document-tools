import { describe, expect, it } from 'vitest';
import { parseNumber, toCellValue } from '../../src/export/cell-value';

describe('parseNumber', () => {
  it.each([
    ['12', 12, '0'],
    ['408.46000', 408.46, '0.00000'],
    ['5,119.18000', 5119.18, '#,##0.00000'],
    ['-12.5', -12.5, '0.0'],
    ['(200,000)', -200000, '#,##0;(#,##0)'],
    ['0', 0, '0'],
    ['0.75', 0.75, '0.00'],
  ])('parses %s', (text, value, format) => {
    expect(parseNumber(text)).toEqual({ value, format });
  });

  it.each([
    '007', // leading zeros are codes
    '1,23', // bad grouping
    '12,3456',
    '10/21/2026',
    '12%',
    'PF 5,119.18',
    '(12',
    '-(12)',
    '1234567890123456', // too long to keep exactly
    '',
  ])('leaves %s as text', (text) => {
    expect(parseNumber(text)).toBeNull();
  });
});

describe('toCellValue', () => {
  it('returns numbers with their format', () => {
    expect(toCellValue('1,097.40')).toEqual({ kind: 'number', value: 1097.4, format: '#,##0.00' });
  });

  it('neutralises formula triggers in text', () => {
    expect(toCellValue('=HYPERLINK("http://x")')).toEqual({ kind: 'text', text: '\'=HYPERLINK("http://x")' });
    expect(toCellValue('@SUM(A1)')).toEqual({ kind: 'text', text: "'@SUM(A1)" });
    expect(toCellValue('+1 555')).toEqual({ kind: 'text', text: "'+1 555" });
  });

  it('keeps negative numbers as numbers, not as neutralised text', () => {
    expect(toCellValue('-5')).toEqual({ kind: 'number', value: -5, format: '0' });
  });

  it('keeps multi-line cells as text', () => {
    expect(toCellValue('12\n13')).toEqual({ kind: 'text', text: '12\n13' });
  });
});
