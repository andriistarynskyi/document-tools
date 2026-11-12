import { cellsToTables, intersectionsToCells } from './cells';
import { filterEdges, mergeEdges } from './edges';
import { edgesToIntersections } from './intersections';
import { buildTable, type ExtractedTable } from '../table/table';
import type { PageContent } from '../geometry/types';

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

/** Finds tables drawn with ruling lines or cell borders. Pure: PageContent in, tables out. */
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
  const tables = cellsToTables(intersectionsToCells(intersections));
  return tables.map((cells) => buildTable(page.pageNumber, cells, page.chars));
}
