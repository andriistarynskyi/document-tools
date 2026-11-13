import type { Merge } from '../core/document/doc-table';
import type { DocumentResult } from '../core/document/document';

export type BlockKind = 'header' | 'table' | 'footer';

/** One section of the sheet. The preview renders blocks; the writer stacks them. */
export interface SheetBlock {
  kind: BlockKind;
  /** Stable id used to include / exclude the block. */
  id: string;
  title: string;
  rows: string[][];
  merges: Merge[];
  /** Rows (block-relative) shown bold: a table's first row. */
  boldRows: number[];
}

/** A merge in absolute sheet coordinates (zero-based, inclusive end). */
export interface SheetMerge {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SheetModel {
  rows: string[][];
  merges: SheetMerge[];
  boldRows: number[];
  /** Width of the widest row. */
  columnCount: number;
}

const overlaps = (a: Merge, b: Merge): boolean =>
  a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan && a.col < b.col + b.colSpan && b.col < a.col + a.colSpan;

/**
 * Keeps merges that do not overlap an earlier one. A spreadsheet cannot merge a cell twice
 * (ExcelJS throws and the whole export would fail). Dropping a merge only loses formatting,
 * never text, so this is handled here deliberately rather than reported as an error.
 */
export function disjointMerges(merges: readonly Merge[]): Merge[] {
  const kept: Merge[] = [];
  for (const m of merges) {
    if (m.rowSpan * m.colSpan > 1 && !kept.some((k) => overlaps(k, m))) kept.push(m);
  }
  return kept;
}

function pageLabel(pages: readonly number[]): string {
  const first = pages[0];
  const last = pages[pages.length - 1];
  return first === last ? `page ${first}` : `pages ${first}–${last}`;
}

/** Splits a document into sheet blocks: header, each table, footer (empty ones omitted). */
export function toBlocks(doc: DocumentResult): SheetBlock[] {
  const blocks: SheetBlock[] = [];
  if (doc.header.length) {
    blocks.push({ kind: 'header', id: 'header', title: 'Page header', rows: doc.header, merges: [], boldRows: [] });
  }
  doc.tables.forEach((t, i) => {
    const size = `${t.rows.length} × ${t.rows[0]?.length ?? 0}`;
    blocks.push({
      kind: 'table',
      id: `table-${i + 1}`,
      title: `Table ${i + 1} · ${pageLabel(t.pages)} · ${size}`,
      rows: t.rows,
      merges: disjointMerges(t.merges),
      boldRows: [0],
    });
  });
  if (doc.footer.length) {
    blocks.push({ kind: 'footer', id: 'footer', title: 'Page footer', rows: doc.footer, merges: [], boldRows: [] });
  }
  return blocks;
}

/** Stacks blocks top to bottom on one sheet with a blank row between neighbours. */
export function assembleSheet(blocks: readonly SheetBlock[]): SheetModel {
  const rows: string[][] = [];
  const merges: SheetMerge[] = [];
  const boldRows: number[] = [];
  blocks.forEach((block, i) => {
    if (i > 0) rows.push([]);
    const offset = rows.length;
    rows.push(...block.rows.map((r) => [...r]));
    boldRows.push(...block.boldRows.map((r) => r + offset));
    for (const m of block.merges) {
      merges.push({ top: m.row + offset, left: m.col, bottom: m.row + offset + m.rowSpan - 1, right: m.col + m.colSpan - 1 });
    }
  });
  return { rows, merges, boldRows, columnCount: Math.max(0, ...rows.map((r) => r.length)) };
}
