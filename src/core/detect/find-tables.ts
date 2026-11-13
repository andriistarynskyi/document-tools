import type { BBox, PageContent } from '../geometry/types';
import { findLatticeTables } from '../lattice/lattice';
import { findStreamTables } from '../stream/stream';
import type { ExtractedTable } from '../table/table';

/** auto: ruled tables first, then text-aligned tables in what is left. */
export type DetectionMode = 'auto' | 'lattice' | 'stream';

/** The page areas a table's text came from (its cells). */
export function claimedAreas(table: ExtractedTable): BBox[] {
  return table.cells.map((c) => c.bbox);
}

/** Detects every table on a page, in reading order (top to bottom, then left to right). */
export function findTables(page: PageContent, mode: DetectionMode = 'auto'): ExtractedTable[] {
  // A single row or column of boxes (a label box, a list) is not a table.
  const ruled = mode === 'stream' ? [] : findLatticeTables(page).filter((t) => t.rowCount >= 2 && t.colCount >= 2);
  // Ruled tables claim their cells, not their bounding box: a form border can enclose text
  // that is in no cell, and that text must stay available to the borderless detector.
  const unruled = mode === 'lattice' ? [] : findStreamTables(page, ruled.flatMap(claimedAreas));
  return [...ruled, ...unruled].sort((a, b) => a.bbox.top - b.bbox.top || a.bbox.x0 - b.bbox.x0);
}
