import { isCentreInside, padBBox } from '../geometry/geometry';
import type { BBox, PageContent } from '../geometry/types';
import type { ExtractedTable, TableCell } from '../table/table';
import { charsToWords } from '../text/words';
import { findBlocks } from './blocks';
import { isLikelyTable } from './classify';
import { findColumnBoundaries } from './columns';
import { buildLines, isTabularLine, type TextLine } from './lines';
import { assignRows, type RowDraft } from './rows';

/** Words this close to a ruled table are treated as part of it. */
export const EXCLUDE_PADDING = 2;

function toTable(page: number, rows: RowDraft[], boundaries: number[], lines: TextLine[]): ExtractedTable {
  // Rows may stop before the end of the block, so only lines inside the rows define the extent.
  const used = lines.filter((l) => l.top <= rows[rows.length - 1].bottom);
  const x0 = Math.min(...used.map((l) => l.words[0].x0));
  const x1 = Math.max(...used.map((l) => l.words[l.words.length - 1].x1));
  const edges = [x0, ...boundaries, x1];
  const cells: TableCell[] = rows.flatMap((row, r) =>
    row.cells.map((text, c) => ({
      bbox: { x0: edges[c], top: row.top, x1: edges[c + 1], bottom: row.bottom },
      row: r, col: c, rowSpan: 1, colSpan: 1, text,
    })),
  );
  return {
    page,
    bbox: { x0, top: rows[0].top, x1, bottom: rows[rows.length - 1].bottom },
    rowCount: rows.length,
    colCount: boundaries.length + 1,
    cells,
    rows: rows.map((r) => r.cells),
  };
}

/**
 * Finds tables without ruling lines from text alignment alone. `exclude` lists regions already
 * claimed by ruled tables, whose words are ignored here.
 */
export function findStreamTables(page: PageContent, exclude: readonly BBox[] = []): ExtractedTable[] {
  const padded = exclude.map((b) => padBBox(b, EXCLUDE_PADDING));
  const words = charsToWords(page.chars.filter((c) => c.upright)).filter(
    (w) => w.upright && !padded.some((b) => isCentreInside(w, b)),
  );

  const tables: ExtractedTable[] = [];
  for (const block of findBlocks(buildLines(words))) {
    const boundaries = findColumnBoundaries(block.filter(isTabularLine));
    if (boundaries.length === 0) continue;
    const rows = assignRows(block, boundaries);
    if (!isLikelyTable(rows.map((r) => r.cells))) continue;
    tables.push(toTable(page.pageNumber, rows, boundaries, block));
  }
  return tables;
}
