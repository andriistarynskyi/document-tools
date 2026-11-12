import type { PageContent } from '../geometry/types';
import { findLatticeTables } from '../lattice/lattice';
import { findStreamTables } from '../stream/stream';
import type { ExtractedTable } from '../table/table';

/** auto: ruled tables first, then text-aligned tables in what is left. */
export type DetectionMode = 'auto' | 'lattice' | 'stream';

/** Detects every table on a page, in reading order (top to bottom, then left to right). */
export function findTables(page: PageContent, mode: DetectionMode = 'auto'): ExtractedTable[] {
  // A single row or column of boxes (a label box, a list) is not a table.
  const ruled = mode === 'stream' ? [] : findLatticeTables(page).filter((t) => t.rowCount >= 2 && t.colCount >= 2);
  const unruled = mode === 'lattice' ? [] : findStreamTables(page, ruled.map((t) => t.bbox));
  return [...ruled, ...unruled].sort((a, b) => a.bbox.top - b.bbox.top || a.bbox.x0 - b.bbox.x0);
}
