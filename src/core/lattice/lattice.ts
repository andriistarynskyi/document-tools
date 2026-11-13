import type { PageContent } from '../geometry/types';
import type { ExtractedTable } from '../table/table';
import { splitByColumnLayout } from './bands';
import { cellsToTables, intersectionsToCells } from './cells';
import { filterEdges, mergeEdges } from './edges';
import { edgesToIntersections } from './intersections';
import { buildTables } from './nesting';
import { splitTextRows } from './text-rows';

/** Mirrors pdfplumber's default table settings for the "lines" strategy. */
export interface LatticeSettings {
  snapTolerance: number;
  joinTolerance: number;
  edgeMinLength: number;
  intersectionTolerance: number;
}

export const DEFAULT_LATTICE_SETTINGS: LatticeSettings = {
  snapTolerance: 3,
  joinTolerance: 3,
  edgeMinLength: 3,
  intersectionTolerance: 3,
};

/**
 * Finds tables drawn with ruling lines or cell borders. Pure: PageContent in, tables out.
 * pdfplumber's cell search, then three refinements for real-world forms: one border split
 * into tables per column layout, text-based rows where only columns are ruled, and boxes
 * nested in a cell resolved so no text appears twice.
 */
export function findLatticeTables(
  page: PageContent,
  settings: LatticeSettings = DEFAULT_LATTICE_SETTINGS,
): ExtractedTable[] {
  const merged = mergeEdges(page.edges, {
    snapX: settings.snapTolerance,
    snapY: settings.snapTolerance,
    joinX: settings.joinTolerance,
    joinY: settings.joinTolerance,
  });
  const edges = filterEdges(merged, settings.edgeMinLength);
  const intersections = edgesToIntersections(edges, {
    x: settings.intersectionTolerance,
    y: settings.intersectionTolerance,
  });
  const groups = cellsToTables(intersectionsToCells(intersections))
    .flatMap(splitByColumnLayout)
    .filter((cells) => cells.length > 1)
    .map((cells) => splitTextRows(cells, page.chars));
  return buildTables(page.pageNumber, groups, page.chars);
}
