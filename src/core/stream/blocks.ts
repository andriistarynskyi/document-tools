import { findColumnGaps, type ColumnGap } from './columns';
import { isTabularLine, type TextLine } from './lines';
import { CONTINUATION_PITCH } from './rows';

/**
 * Max line pitch (in line heights) between two tabular lines of one block. Generous, so a
 * blank gap between a header and its first row, or between spaced-out rows, is tolerated.
 */
const MAX_TABULAR_PITCH = 7;

/** A word straddles a boundary when it sticks out at least this much (× line height) on both sides. */
const STRADDLE_FACTOR = 0.3;
/**
 * One misplaced word is tolerated: a long header spanning two columns, or the header of a
 * column that is empty in every body row (its words sit in what looks like a gap below).
 */
const MAX_MISPLACED_WORDS = 1;
const MIN_LINES_FOR_TRIM = 3;
const BASE_LINES = 2;

const pitch = (from: TextLine, to: TextLine): number => (to.top - from.top) / from.height;

/**
 * Whether lines[j] belongs to the block. A loose single-segment line (e.g. a note carried
 * over from the previous page, sitting between a header and the first row) is kept when
 * the next tabular line is still close enough to continue the table.
 */
function canExtend(block: readonly TextLine[], lines: readonly TextLine[], j: number): boolean {
  const prev = block[block.length - 1];
  const line = lines[j];
  if (isTabularLine(line)) return pitch(prev, line) <= MAX_TABULAR_PITCH;
  if (pitch(prev, line) <= CONTINUATION_PITCH) return true;
  const next = lines.slice(j + 1).find(isTabularLine);
  return next !== undefined && pitch(prev, next) <= MAX_TABULAR_PITCH;
}

/**
 * Words of `line` that cross a column boundary or lie entirely inside the gap between two
 * columns. Header words that are merely wider than the values below them do neither.
 */
function misplacedCount(line: TextLine, gaps: readonly ColumnGap[]): number {
  const margin = STRADDLE_FACTOR * line.height;
  return line.words.filter((w) =>
    gaps.some((g) => {
      const mid = (g.start + g.end) / 2;
      const isStraddling = mid - w.x0 > margin && w.x1 - mid > margin;
      const isInsideGap = w.x0 > g.start && w.x1 < g.end;
      return isStraddling || isInsideGap;
    }),
  ).length;
}

/** A line fits the table below it when (almost) all of its words sit inside that table's columns. */
function fitsColumns(line: TextLine, below: readonly TextLine[]): boolean {
  return misplacedCount(line, findColumnGaps(below)) <= MAX_MISPLACED_WORDS;
}

/**
 * A block can swallow unrelated tabular text just above the real table (an address block
 * followed by a header, say). Header words sit inside the columns of the rows below them;
 * an outsider's words cut across those columns or fall into the gaps between them. Grow
 * upward from the last lines and stop at the first line that does not fit.
 */
function trimLeadingMisfits(block: TextLine[]): TextLine[] {
  const tabular = block.filter(isTabularLine);
  if (tabular.length < MIN_LINES_FOR_TRIM) return block;

  let start = tabular.length - BASE_LINES;
  while (start > 0 && fitsColumns(tabular[start - 1], tabular.slice(start))) start--;
  return block.slice(block.indexOf(tabular[start]));
}

/**
 * Finds runs of lines that look like a table body: lines with two or more gap-separated
 * segments, plus the single-segment lines (wrapped text, notes) between and after them.
 */
export function findBlocks(lines: readonly TextLine[]): TextLine[][] {
  const blocks: TextLine[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (!isTabularLine(lines[i])) {
      i++;
      continue;
    }
    const block: TextLine[] = [lines[i]];
    let j = i + 1;
    for (; j < lines.length && canExtend(block, lines, j); j++) block.push(lines[j]);
    const trimmed = trimLeadingMisfits(block);
    if (trimmed.filter(isTabularLine).length >= 2) blocks.push(trimmed);
    i = j;
  }
  return blocks;
}
