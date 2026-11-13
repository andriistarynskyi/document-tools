import { claimedAreas, findTables, type DetectionMode } from '../detect/find-tables';
import { isCentreInside, padBBox } from '../geometry/geometry';
import type { BBox, PageContent } from '../geometry/types';
import { buildLines } from '../stream/lines';
import { EXCLUDE_PADDING } from '../stream/stream';
import type { ExtractedTable } from '../table/table';
import { charsToWords } from '../text/words';

/** A text line outside every table, kept as its gap-separated segments. */
export interface PageLine extends BBox {
  cells: string[];
}

/**
 * Everything document assembly needs from one page. Chars and edges are dropped, so a long
 * document can be summarised page by page without holding every glyph in memory.
 */
export interface PageSummary {
  pageNumber: number;
  height: number;
  tables: ExtractedTable[];
  lines: PageLine[];
}

export function summarizePage(page: PageContent, mode: DetectionMode = 'auto'): PageSummary {
  const tables = findTables(page, mode);
  const claimed = tables.flatMap(claimedAreas).map((b) => padBBox(b, EXCLUDE_PADDING));
  // Only horizontal text can be a header or footer line; sideways margin text is ignored.
  const words = charsToWords(page.chars.filter((c) => c.upright))
    .filter((w) => !claimed.some((b) => isCentreInside(w, b)));
  const lines = buildLines(words).map((l) => ({
    x0: l.words[0].x0,
    x1: l.words[l.words.length - 1].x1,
    top: l.top,
    bottom: l.bottom,
    cells: l.segments.map((s) => s.text),
  }));
  return { pageNumber: page.pageNumber, height: page.height, tables, lines };
}
