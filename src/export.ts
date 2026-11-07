import ExcelJS from 'exceljs';
import type { DetectedTable } from './pdf-tables';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIN_COL_WIDTH = 8;
const MAX_COL_WIDTH = 50;

// Characters that make a spreadsheet cell a live formula. PDF text is untrusted, so any
// cell starting with one of these is neutralized to prevent CSV/Excel formula injection.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

function sanitize(text: string): string {
  return FORMULA_TRIGGERS.test(text) ? `'${text}` : text;
}

function toValue(text: string): string | number {
  // Plain numbers become real numbers; keep leading zeros (ids, codes) as text.
  // Numbers can't carry a formula payload, so they skip sanitization.
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (text.length < 16 && Number.isFinite(n)) return n; // avoid precision loss on long digit runs
  }
  return sanitize(text);
}

function buildWorkbook(tables: DetectedTable[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  for (const t of tables) {
    const ws = wb.addWorksheet(`Table ${t.id} (p${t.page})`);
    t.rows.forEach((r) => ws.addRow(r.map(toValue)));
    t.rows[0].forEach((_, c) => {
      const longest = t.rows.reduce((max, r) => Math.max(max, r[c].length), 0);
      ws.getColumn(c + 1).width = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, longest + 2));
    });
  }
  return wb;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a); // some browsers ignore clicks on detached anchors
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Builds one workbook (one sheet per table) and triggers a browser download. */
export async function exportTables(tables: DetectedTable[], sourceName: string): Promise<void> {
  if (!tables.length) throw new Error('No tables to export');
  const buffer = await buildWorkbook(tables).xlsx.writeBuffer();
  const base = sourceName.replace(/\.pdf$/i, '') || 'tables';
  download(new Blob([buffer], { type: XLSX_MIME }), `${base}-tables.xlsx`);
}
