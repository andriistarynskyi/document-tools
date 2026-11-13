import { applyToPoint, applyToVector, type Matrix } from '../core/geometry/matrix';
import type { Char } from '../core/geometry/types';

/** The subset of a pdf.js TextItem this module needs. */
export interface TextRun {
  str: string;
  width: number;
  height: number;
  transform: readonly number[];
}

const NARROW = new Set("iljtfI.,;:'|!()[]\" ");
const WIDE = new Set('mwMW@%');
const UPRIGHT_SLOPE = 0.05;

/** pdf.js hands us whole text runs, not glyphs; this approximates relative glyph widths. */
function glyphWeight(ch: string): number {
  if (NARROW.has(ch)) return 0.5;
  if (WIDE.has(ch)) return 1.5;
  if (ch >= 'A' && ch <= 'Z') return 1.1;
  return 1;
}

function unit(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y);
  return len === 0 ? [0, 0] : [x / len, y / len];
}

type Vec = readonly [number, number];

/** A run's text-space frame: baseline origin, reading direction and "up" direction (unit vectors). */
interface RunFrame {
  origin: Vec;
  dir: Vec;
  up: Vec;
  size: number;
}

function runFrame(run: TextRun): RunFrame {
  const [a, b, c, d, e, f] = run.transform;
  return { origin: [e, f], dir: unit(a, b), up: unit(c, d), size: Math.hypot(c, d) || run.height };
}

/**
 * Page box of the glyph that spans [start, end] along the baseline: its four corners are
 * mapped through the viewport (which may rotate and flips y), then the extremes are taken.
 */
function glyphBox(frame: RunFrame, start: number, end: number, viewport: Matrix) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of [start, end]) {
    for (const t of [0, frame.size]) {
      const px = frame.origin[0] + frame.dir[0] * s + frame.up[0] * t;
      const py = frame.origin[1] + frame.dir[1] * s + frame.up[1] * t;
      const [x, y] = applyToPoint(viewport, px, py);
      xs.push(x);
      ys.push(y);
    }
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** Text reads left to right on the page when its direction is (nearly) horizontal after the viewport. */
function isUpright(frame: RunFrame, viewport: Matrix): boolean {
  const [vx, vy] = applyToVector(viewport, frame.dir[0], frame.dir[1]);
  return Math.abs(vy) <= UPRIGHT_SLOPE * Math.abs(vx);
}

/**
 * Splits one text run into per-character boxes in page (top-left origin) coordinates.
 * Run edges are exact; interior glyph boundaries are estimated from relative glyph widths.
 */
export function splitRun(run: TextRun, viewport: Matrix): Char[] {
  const glyphs = Array.from(run.str);
  if (glyphs.length === 0 || run.width <= 0) return [];

  const frame = runFrame(run);
  const upright = isUpright(frame, viewport);
  const weights = glyphs.map(glyphWeight);
  const total = weights.reduce((s, w) => s + w, 0);
  let offset = 0;
  return glyphs.map((text, i) => {
    const width = (weights[i] / total) * run.width;
    const box = glyphBox(frame, offset, offset + width, viewport);
    offset += width;
    return { text, size: frame.size, upright, ...box };
  });
}

/** Splits every text run of a page into chars, in content order. */
export function splitRuns(runs: readonly TextRun[], viewport: Matrix): Char[] {
  return runs.flatMap((run) => splitRun(run, viewport));
}
