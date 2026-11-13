import type { DocTable, Merge } from './doc-table';

/** Collapses runs of spaces inside each line of a cell and trims it. Line breaks are kept. */
export function cleanText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** old index -> new index, or -1 for removed entries. */
function keepMap(keep: readonly boolean[]): number[] {
  let next = 0;
  return keep.map((k) => (k ? next++ : -1));
}

/** Shrinks a span [start, start + span) to the kept indexes; null when nothing is kept. */
function remapSpan(start: number, span: number, map: readonly number[]): [number, number] | null {
  const kept = map.slice(start, start + span).filter((i) => i >= 0);
  return kept.length ? [kept[0], kept[kept.length - 1] - kept[0] + 1] : null;
}

function remapMerges(merges: readonly Merge[], rowMap: readonly number[], colMap: readonly number[]): Merge[] {
  return merges.flatMap((m) => {
    const rows = remapSpan(m.row, m.rowSpan, rowMap);
    const cols = remapSpan(m.col, m.colSpan, colMap);
    if (!rows || !cols || (rows[1] === 1 && cols[1] === 1)) return [];
    return [{ row: rows[0], rowSpan: rows[1], col: cols[0], colSpan: cols[1] }];
  });
}

/** Cleans cell text and drops rows and columns that are empty everywhere. */
export function normalizeTable(table: DocTable): DocTable {
  const cleaned = table.rows.map((r) => r.map(cleanText));
  const width = cleaned[0]?.length ?? 0;
  const keepRow = cleaned.map((r) => r.some(Boolean));
  const keepCol = Array.from({ length: width }, (_, c) => cleaned.some((r) => r[c] !== ''));
  const rowMap = keepMap(keepRow);
  const colMap = keepMap(keepCol);
  return {
    ...table,
    pages: [...table.pages],
    rows: cleaned.filter((_, r) => keepRow[r]).map((r) => r.filter((_, c) => keepCol[c])),
    merges: remapMerges(table.merges, rowMap, colMap),
    columns: table.columns.filter((_, c) => keepCol[c]),
  };
}
