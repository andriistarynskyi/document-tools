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

/**
 * Splits one text run into per-character boxes in page (top-left origin) coordinates.
 * Run edges are exact; interior glyph boundaries are estimated from relative glyph widths.
 */
export function splitRun(run: TextRun, viewport: Matrix): Char[] {
  const glyphs = Array.from(run.str);
  if (glyphs.length === 0 || run.width <= 0) return [];

  const [a, b, c, d, e, f] = run.transform;
  const dir = unit(a, b);
  const up = unit(c, d);
  const size = Math.hypot(c, d) || run.height;
  const [vx, vy] = applyToVector(viewport, dir[0], dir[1]);
  const upright = Math.abs(vy) <= UPRIGHT_SLOPE * Math.abs(vx);

  const weights = glyphs.map(glyphWeight);
  const total = weights.reduce((s, w) => s + w, 0);
  const chars: Char[] = [];
  let offset = 0;

  glyphs.forEach((text, i) => {
    const w = (weights[i] / total) * run.width;
    const xs = [offset, offset + w];
    const ys = [0, size];
    const px: number[] = [];
    const py: number[] = [];
    for (const s of xs) {
      for (const t of ys) {
        const [x, y] = applyToPoint(viewport, e + dir[0] * s + up[0] * t, f + dir[1] * s + up[1] * t);
        px.push(x);
        py.push(y);
      }
    }
    chars.push({
      text,
      size,
      upright,
      x0: Math.min(...px),
      x1: Math.max(...px),
      top: Math.min(...py),
      bottom: Math.max(...py),
    });
    offset += w;
  });
  return chars;
}

export function splitRuns(runs: readonly TextRun[], viewport: Matrix): Char[] {
  return runs.flatMap((run) => splitRun(run, viewport));
}
