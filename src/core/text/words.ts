/*
 * Ported from pdfplumber (https://github.com/jsvine/pdfplumber), utils/text.py
 * (WordExtractor, extract_text; layout mode is not ported).
 * pdfplumber is MIT licensed. Copyright (c) 2015 Jeremy Singer-Vine.
 * See the license banner emitted into the production bundle.
 */
import { clusterObjects } from '../geometry/cluster';
import { objectsToBBox } from '../geometry/geometry';
import type { Char, Word } from '../geometry/types';

export interface TextTolerances {
  xTolerance: number;
  yTolerance: number;
}

export const DEFAULT_TEXT_TOLERANCES: TextTolerances = { xTolerance: 3, yTolerance: 3 };

const isSpace = (text: string): boolean => /^\s+$/.test(text);

function beginsNewWord(prev: Char, cur: Char, tol: TextTolerances): boolean {
  return (
    cur.x0 < prev.x0 ||
    cur.x0 > prev.x1 + tol.xTolerance ||
    cur.top < prev.top - tol.yTolerance ||
    cur.top > prev.top + tol.yTolerance
  );
}

function toWord(chars: Char[]): Word {
  return {
    ...objectsToBBox(chars),
    text: chars.map((c) => c.text).join(''),
    upright: chars.every((c) => c.upright),
  };
}

/** Groups chars into words. Chars are first split into visual lines, then read left to right. */
export function charsToWords(chars: readonly Char[], tol = DEFAULT_TEXT_TOLERANCES): Word[] {
  const words: Word[] = [];
  for (const line of clusterObjects(chars, (c) => c.top, tol.yTolerance)) {
    const ordered = [...line].sort((a, b) => a.x0 - b.x0);
    let current: Char[] = [];
    for (const ch of ordered) {
      if (isSpace(ch.text)) {
        if (current.length) words.push(toWord(current));
        current = [];
      } else if (current.length && beginsNewWord(current[current.length - 1], ch, tol)) {
        words.push(toWord(current));
        current = [ch];
      } else {
        current.push(ch);
      }
    }
    if (current.length) words.push(toWord(current));
  }
  return words;
}

/** Plain-text reading of chars: words joined by spaces, visual lines joined by "\n". */
export function extractText(chars: readonly Char[], tol = DEFAULT_TEXT_TOLERANCES): string {
  const lines = clusterObjects(charsToWords(chars, tol), (w) => w.top, tol.yTolerance);
  return lines
    .map((line) => [...line].sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' '))
    .join('\n');
}
