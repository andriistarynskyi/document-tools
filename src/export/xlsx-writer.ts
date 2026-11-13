import ExcelJS from 'exceljs';
import { toCellValue } from './cell-value';
import type { SheetModel } from './sheet-layout';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const MIN_COL_WIDTH = 8;
const MAX_COL_WIDTH = 50;
const INVALID_SHEET_CHARS = /[\[\]:*?/\\]/g;
const MAX_SHEET_NAME = 31;

/** Excel sheet names: max 31 chars, none of []:*?/\ and not blank. */
export function sheetName(source: string): string {
  const base = source.replace(/\.pdf$/i, '').replace(INVALID_SHEET_CHARS, ' ').trim();
  return (base || 'Tables').slice(0, MAX_SHEET_NAME);
}

function longestLine(text: string): number {
  return Math.max(0, ...text.split('\n').map((l) => l.length));
}

function columnWidths(model: SheetModel): number[] {
  const widths = new Array<number>(model.columnCount).fill(MIN_COL_WIDTH);
  for (const row of model.rows) {
    row.forEach((text, c) => {
      widths[c] = Math.min(MAX_COL_WIDTH, Math.max(widths[c], longestLine(text) + 2));
    });
  }
  return widths;
}

function writeCell(cell: ExcelJS.Cell, text: string): void {
  const value = toCellValue(text);
  if (value.kind === 'number') {
    cell.value = value.value;
    cell.numFmt = value.format;
  } else {
    cell.value = value.text;
    if (value.text.includes('\n')) cell.alignment = { wrapText: true, vertical: 'top' };
  }
}

/** Builds a workbook with a single sheet laid out from the model. */
export function buildWorkbook(model: SheetModel, source: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName(source));
  model.rows.forEach((row, r) => {
    const excelRow = ws.getRow(r + 1);
    row.forEach((text, c) => {
      if (text) writeCell(excelRow.getCell(c + 1), text);
    });
  });
  for (const r of model.boldRows) ws.getRow(r + 1).font = { bold: true };
  for (const m of model.merges) ws.mergeCells(m.top + 1, m.left + 1, m.bottom + 1, m.right + 1);
  columnWidths(model).forEach((w, c) => {
    ws.getColumn(c + 1).width = w;
  });
  return wb;
}

export async function writeXlsx(model: SheetModel, source: string): Promise<ArrayBuffer> {
  const buffer = await buildWorkbook(model, source).xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
