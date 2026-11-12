import { clusterObjects } from '../geometry/cluster';
import type { Word } from '../geometry/types';

/** A run of words separated only by ordinary word spacing (a "phrase" / cell candidate). */
export interface Segment {
  text: string;
  x0: number;
  x1: number;
  words: Word[];
}

export interface TextLine {
  top: number;
  bottom: number;
  /** Approximate font height of the line. */
  height: number;
  words: Word[];
  segments: Segment[];
}

/** Gaps wider than this multiple of the line height separate segments. */
const SEGMENT_GAP_FACTOR = 1.1;
const MIN_SEGMENT_GAP = 6;
const LINE_Y_TOLERANCE = 3;

function toSegments(words: Word[], height: number): Segment[] {
  const limit = Math.max(MIN_SEGMENT_GAP, SEGMENT_GAP_FACTOR * height);
  const segments: Segment[] = [];
  let current: Word[] = [];
  const flush = (): void => {
    if (current.length === 0) return;
    segments.push({
      text: current.map((w) => w.text).join(' '),
      x0: current[0].x0,
      x1: current[current.length - 1].x1,
      words: current,
    });
    current = [];
  };
  for (const w of words) {
    const prev = current[current.length - 1];
    if (prev && w.x0 - prev.x1 > limit) flush();
    current.push(w);
  }
  flush();
  return segments;
}

/** Groups words into visual lines (top to bottom), each split into gap-separated segments. */
export function buildLines(words: readonly Word[]): TextLine[] {
  return clusterObjects(words, (w) => w.top, LINE_Y_TOLERANCE).map((group) => {
    const sorted = [...group].sort((a, b) => a.x0 - b.x0);
    const height = Math.max(...sorted.map((w) => w.bottom - w.top));
    return {
      top: Math.min(...sorted.map((w) => w.top)),
      bottom: Math.max(...sorted.map((w) => w.bottom)),
      height,
      words: sorted,
      segments: toSegments(sorted, height),
    };
  });
}

export const isTabularLine = (line: TextLine): boolean => line.segments.length >= 2;
