import type { Word } from '../../src/core/geometry/types';
import { buildLines, type TextLine } from '../../src/core/stream/lines';

/** Approximate width of one char at 10pt in the synthetic layouts. */
export const CHAR_W = 5;
export const LINE_H = 10;

export function word(text: string, x: number, top: number): Word {
  return { text, x0: x, x1: x + text.length * CHAR_W, top, bottom: top + LINE_H, upright: true };
}

/**
 * One visual line from [x, text] pairs. Each text is split into words separated by one
 * normal space (1 char width), so a multi-word cell stays a single segment.
 */
export function lineWords(top: number, cells: Array<[number, string]>): Word[] {
  return cells.flatMap(([x, text]) => {
    let cursor = x;
    return text.split(' ').map((t) => {
      const w = word(t, cursor, top);
      cursor = w.x1 + CHAR_W;
      return w;
    });
  });
}

/** Builds TextLines from rows of [x, text] cells, one row every `pitch` points from `top`. */
export function textLines(rows: Array<Array<[number, string]>>, top = 100, pitch = 14): TextLine[] {
  return buildLines(rows.flatMap((cells, i) => lineWords(top + i * pitch, cells)));
}
