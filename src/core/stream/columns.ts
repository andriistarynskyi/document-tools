import type { TextLine } from './lines';

/** Narrowest gap accepted as a column gap (glyph widths are estimated, so real gaps can look tiny). */
const MIN_GAP_WIDTH = 1;
const EDGE_SLACK = 1;
/** Word edges within this many line heights of a gap edge count as aligned to it. */
const ALIGN_FACTOR = 0.5;
/** A column gap needs word edges from at least this many lines lined up along it. */
const MIN_ALIGNED_LINES = 2;

interface Event {
  x: number;
  delta: 1 | -1;
}

/** An x-range between two columns that no word crosses. */
export interface ColumnGap {
  start: number;
  end: number;
}

function coverageEvents(lines: readonly TextLine[]): Event[] {
  const events: Event[] = [];
  for (const line of lines) {
    for (const w of line.words) events.push({ x: w.x0, delta: 1 }, { x: w.x1, delta: -1 });
  }
  // Closings first at equal x, so touching words do not fake an uncovered point.
  return events.sort((a, b) => a.x - b.x || a.delta - b.delta);
}

/** Interior x-ranges that no word on any line covers (page margins are excluded). */
function findRivers(lines: readonly TextLine[]): ColumnGap[] {
  const rivers: ColumnGap[] = [];
  let covered = 0;
  let start: number | null = null;
  for (const event of coverageEvents(lines)) {
    covered += event.delta;
    if (covered === 0) {
      start = event.x;
    } else if (start !== null) {
      if (event.x - start >= MIN_GAP_WIDTH) rivers.push({ start, end: event.x });
      start = null;
    }
  }
  return rivers;
}

/** At least one line must have a real segment break across the river. */
function hasSegmentBreak(river: ColumnGap, lines: readonly TextLine[]): boolean {
  return lines.some((line) =>
    line.segments.some(
      (seg, i) => i > 0 && line.segments[i - 1].x1 <= river.start + EDGE_SLACK && seg.x0 >= river.end - EDGE_SLACK,
    ),
  );
}

/**
 * Columns are aligned: several lines end a word at the river's left edge or start one at its
 * right edge. A one-off gap between two words of a single long cell fails this test.
 */
function isAligned(river: ColumnGap, lines: readonly TextLine[]): boolean {
  const touching = lines.filter((line) => {
    const tol = ALIGN_FACTOR * line.height;
    return line.words.some((w) => Math.abs(w.x1 - river.start) <= tol || Math.abs(w.x0 - river.end) <= tol);
  });
  return touching.length >= Math.min(MIN_ALIGNED_LINES, lines.length);
}

/**
 * Finds the gaps between columns: x-ranges no word crosses on any of the given lines, that
 * at least one line breaks across and that several lines align to. Pass only tabular lines
 * (spanning titles or wrapped notes must not define columns). Ascending order.
 */
export function findColumnGaps(lines: readonly TextLine[]): ColumnGap[] {
  return findRivers(lines).filter((r) => hasSegmentBreak(r, lines) && isAligned(r, lines));
}

/** Column boundaries (gap midpoints). N boundaries mean N + 1 columns. */
export function findColumnBoundaries(lines: readonly TextLine[]): number[] {
  return findColumnGaps(lines).map((g) => (g.start + g.end) / 2);
}

/** Index of the column a horizontal position falls in. */
export function columnOf(x: number, boundaries: readonly number[]): number {
  let col = 0;
  while (col < boundaries.length && x > boundaries[col]) col++;
  return col;
}
