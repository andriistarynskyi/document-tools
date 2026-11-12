import { columnOf } from './columns';
import { isTabularLine, type TextLine } from './lines';

export interface RowDraft {
  cells: string[];
  top: number;
  bottom: number;
  /** Line height of the row's first line, used for pitch tests. */
  lineHeight: number;
  lastTop: number;
  isFromTabularLine: boolean;
}

/** Two tabular lines closer than this multiple of the line height belong to one row (e.g. a 2-line header). */
const SAME_ROW_PITCH = 1.1;
/** A single-segment line this close below the previous line is wrapped text. */
export const CONTINUATION_PITCH = 1.9;
/** How far (× line height) a row label may run past the first column boundary. */
const LABEL_OVERRUN_FACTOR = 0.5;

const emptyCells = (n: number): string[] => new Array<string>(n).fill('');

function tabularCells(line: TextLine, boundaries: readonly number[]): string[] {
  const cells = emptyCells(boundaries.length + 1);
  for (const w of line.words) {
    const col = columnOf((w.x0 + w.x1) / 2, boundaries);
    cells[col] = cells[col] ? `${cells[col]} ${w.text}` : w.text;
  }
  return cells;
}

/** Wrapped text stays whole: the full line goes into the column its first word starts in. */
function wrappedCell(line: TextLine, boundaries: readonly number[]): { col: number; text: string } {
  const first = line.words[0];
  return { col: columnOf((first.x0 + first.x1) / 2, boundaries), text: line.words.map((w) => w.text).join(' ') };
}

/** A section label ("Current assets") sits within the first column; prose runs across columns. */
function isRowLabel(line: TextLine, col: number, boundaries: readonly number[]): boolean {
  if (col !== 0) return false;
  const limit = boundaries.length ? boundaries[0] + LABEL_OVERRUN_FACTOR * line.height : Infinity;
  return line.words[line.words.length - 1].x1 <= limit;
}

const newRow = (cells: string[], line: TextLine, isTabular: boolean): RowDraft => ({
  cells,
  top: line.top,
  bottom: line.bottom,
  lineHeight: line.height,
  lastTop: line.top,
  isFromTabularLine: isTabular,
});

function append(row: RowDraft, col: number, text: string, line: TextLine, joiner: string): void {
  row.cells[col] = row.cells[col] ? `${row.cells[col]}${joiner}${text}` : text;
  row.bottom = Math.max(row.bottom, line.bottom);
  row.lastTop = line.top;
}

function singleCellRow(col: number, text: string, line: TextLine, width: number): RowDraft {
  const cells = emptyCells(width);
  cells[col] = text;
  return newRow(cells, line, false);
}

/**
 * Turns a block of lines into rows.
 * - Tabular lines start rows; tight-pitch ones merge (multi-line headers).
 * - A tight single-segment line under a cell that has text is wrapped text: it is appended.
 * - Under an empty cell it is a row label if it fits in the first column; anything else is
 *   not part of the table (e.g. prose after a totals row) and ends it.
 * - A loose single-segment line becomes its own row (a note between header and rows).
 */
export function assignRows(lines: readonly TextLine[], boundaries: readonly number[]): RowDraft[] {
  const rows: RowDraft[] = [];
  const width = boundaries.length + 1;
  for (const line of lines) {
    const last = rows[rows.length - 1];
    const pitch = last ? (line.top - last.lastTop) / last.lineHeight : Infinity;
    if (isTabularLine(line)) {
      const cells = tabularCells(line, boundaries);
      if (last?.isFromTabularLine && pitch <= SAME_ROW_PITCH) {
        cells.forEach((text, col) => text && append(last, col, text, line, ' '));
      } else {
        rows.push(newRow(cells, line, true));
      }
      continue;
    }
    const { col, text } = wrappedCell(line, boundaries);
    if (!last || pitch > CONTINUATION_PITCH) rows.push(singleCellRow(col, text, line, width));
    else if (last.cells[col]) append(last, col, text, line, '\n');
    else if (isRowLabel(line, col, boundaries)) rows.push(singleCellRow(col, text, line, width));
    else break;
  }
  return rows;
}
