/*
 * Ported from pdfplumber (https://github.com/jsvine/pdfplumber), utils/geometry.py.
 * pdfplumber is MIT licensed. Copyright (c) 2015 Jeremy Singer-Vine.
 * See the license banner emitted into the production bundle.
 */
import type { BBox } from './types';

/** Smallest box containing all of the given boxes. Throws on empty input. */
export function objectsToBBox(objs: readonly BBox[]): BBox {
  if (objs.length === 0) throw new Error('objectsToBBox: empty input');
  return {
    x0: Math.min(...objs.map((o) => o.x0)),
    top: Math.min(...objs.map((o) => o.top)),
    x1: Math.max(...objs.map((o) => o.x1)),
    bottom: Math.max(...objs.map((o) => o.bottom)),
  };
}

/** Intersection of two boxes, or null when they neither overlap nor touch. */
export function getBBoxOverlap(a: BBox, b: BBox): BBox | null {
  const x0 = Math.max(a.x0, b.x0);
  const x1 = Math.min(a.x1, b.x1);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = x1 - x0;
  const height = bottom - top;
  if (width >= 0 && height >= 0 && width + height > 0) return { x0, top, x1, bottom };
  return null;
}

/** Grows a box by `amount` on every side. */
export function padBBox(b: BBox, amount: number): BBox {
  return { x0: b.x0 - amount, top: b.top - amount, x1: b.x1 + amount, bottom: b.bottom + amount };
}

/** True when the object's centre lies inside the box (pdfplumber's crop test). */
export function isCentreInside(obj: BBox, box: BBox): boolean {
  const cx = (obj.x0 + obj.x1) / 2;
  const cy = (obj.top + obj.bottom) / 2;
  return cx >= box.x0 && cx < box.x1 && cy >= box.top && cy < box.bottom;
}
