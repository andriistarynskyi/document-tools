import { clusterObjects } from '../geometry/cluster';
import { isCentreInside, objectsToBBox } from '../geometry/geometry';
import type { BBox, Char, Word } from '../geometry/types';
import { charsToWords, DEFAULT_TEXT_TOLERANCES } from '../text/words';
import { innerColumnLines, toBands } from './bands';

/** A line must fill at least this share of the band's columns to start a new record. */
const MIN_RECORD_FILL = 0.5;
/** ...and sit at least this many line heights below the previous line (wrapped text is tighter). */
const MIN_RECORD_PITCH = 1.3;

interface TextLine {
  top: number;
  bottom: number;
  words: Word[];
}

function textLines(chars: readonly Char[], area: BBox): TextLine[] {
  const words = charsToWords(chars.filter((c) => c.upright && isCentreInside(c, area)));
  return clusterObjects(words, (w) => w.top, DEFAULT_TEXT_TOLERANCES.yTolerance).map((ws) => ({
    top: Math.min(...ws.map((w) => w.top)),
    bottom: Math.max(...ws.map((w) => w.bottom)),
    words: ws,
  }));
}

function filledColumns(line: TextLine, lines: readonly number[]): number {
  const cols = line.words.map((w) => lines.filter((x) => x < (w.x0 + w.x1) / 2).length);
  return new Set(cols).size;
}

/**
 * True when a drawn row line already separates the two text lines (in some column). Compared
 * between line centres: glyph boxes often start just above the ruled line they sit under.
 */
function isRuledBetween(band: readonly BBox[], above: TextLine, below: TextLine): boolean {
  const from = (above.top + above.bottom) / 2;
  const to = (below.top + below.bottom) / 2;
  return band.some((c) => [c.top, c.bottom].some((y) => y > from && y < to));
}

/**
 * y positions between records, where a line starts a new record (see the constants). Only
 * gaps without a drawn row line are cut: cutting at a ruled line would only break up a
 * genuinely merged cell (e.g. a group label spanning several ruled rows).
 */
function recordCuts(band: readonly BBox[], chars: readonly Char[]): number[] {
  const columns = innerColumnLines(band);
  const minFill = Math.max(2, Math.ceil(MIN_RECORD_FILL * (columns.length + 1)));
  const lines = textLines(chars, objectsToBBox(band));
  const cuts: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const line = lines[i];
    const height = line.bottom - line.top || 1;
    const isRecordStart = filledColumns(line, columns) >= minFill && (line.top - prev.top) / height >= MIN_RECORD_PITCH;
    if (isRecordStart && !isRuledBetween(band, prev, line)) cuts.push((prev.bottom + line.top) / 2);
  }
  return cuts;
}

function cutCell(cell: BBox, cuts: readonly number[]): BBox[] {
  const inside = cuts.filter((y) => cell.top < y && y < cell.bottom);
  const ys = [cell.top, ...inside, cell.bottom];
  return ys.slice(1).map((bottom, i) => ({ ...cell, top: ys[i], bottom }));
}

/**
 * Many tables rule their columns but not their rows: every column is one tall cell holding
 * all records. Such bands are split into rows from the text, so each record gets its own row.
 */
export function splitTextRows(cells: readonly BBox[], chars: readonly Char[]): BBox[] {
  return toBands(cells).flatMap((band) => {
    const cuts = recordCuts(band, chars);
    return cuts.length ? band.flatMap((cell) => cutCell(cell, cuts)) : band;
  });
}
