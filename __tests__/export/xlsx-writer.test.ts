import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { SheetModel } from '../../src/export/sheet-layout';
import { sheetName, writeXlsx } from '../../src/export/xlsx-writer';

const MODEL: SheetModel = {
  rows: [
    ['ACME Ltd'],
    [],
    ['Item', 'Qty', 'Total'],
    ['Valve\nlow pressure', '30', '12,253.80'],
    ['=cmd()', '007', '(5.00)'],
    ['Group', '', ''],
  ],
  merges: [{ top: 5, left: 0, bottom: 5, right: 2 }],
  boldRows: [2],
  columnCount: 3,
};

async function readBack(model: SheetModel): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await writeXlsx(model, 'quote 17768124.pdf'));
  expect(wb.worksheets).toHaveLength(1);
  return wb.worksheets[0];
}

describe('writeXlsx', () => {
  it('writes one sheet named after the file', async () => {
    expect((await readBack(MODEL)).name).toBe('quote 17768124');
  });

  it('writes numbers as numbers with a matching display format', async () => {
    const ws = await readBack(MODEL);
    expect(ws.getCell('B4').value).toBe(30);
    expect(ws.getCell('C4').value).toBe(12253.8);
    expect(ws.getCell('C4').numFmt).toBe('#,##0.00');
    expect(ws.getCell('C5').value).toBe(-5);
  });

  it('keeps codes with leading zeros as text and neutralises formulas', async () => {
    const ws = await readBack(MODEL);
    expect(ws.getCell('B5').value).toBe('007');
    expect(ws.getCell('A5').value).toBe("'=cmd()");
    expect(ws.getCell('A5').formula).toBeUndefined();
  });

  it('wraps multi-line cells', async () => {
    const ws = await readBack(MODEL);
    expect(ws.getCell('A4').value).toBe('Valve\nlow pressure');
    expect(ws.getCell('A4').alignment?.wrapText).toBe(true);
  });

  it('applies merges and bold header rows', async () => {
    const ws = await readBack(MODEL);
    expect(ws.getCell('C6').isMerged).toBe(true);
    expect(ws.getCell('A3').font?.bold).toBe(true);
    expect(ws.getCell('A4').font?.bold).toBeFalsy();
  });
});

describe('sheetName', () => {
  it('strips the extension and forbidden characters, and caps the length', () => {
    expect(sheetName('a/b:c?.pdf')).toBe('a b c');
    expect(sheetName('x'.repeat(40) + '.pdf')).toHaveLength(31);
    expect(sheetName('.pdf')).toBe('Tables');
  });
});
