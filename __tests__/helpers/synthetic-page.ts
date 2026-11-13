import type { Char, Edge, PageContent } from '../../src/core/geometry/types';

export const hEdge = (x0: number, x1: number, y: number): Edge => ({
  orientation: 'h', x0, x1, top: y, bottom: y, width: x1 - x0, height: 0,
});
export const vEdge = (x: number, top: number, bottom: number): Edge => ({
  orientation: 'v', x0: x, x1: x, top, bottom, width: 0, height: bottom - top,
});

/** Full grid lines for the given column / row coordinates. */
export function gridEdges(xs: number[], ys: number[]): Edge[] {
  const [xa, xb, ya, yb] = [xs[0], xs[xs.length - 1], ys[0], ys[ys.length - 1]];
  return [...xs.map((x) => vEdge(x, ya, yb)), ...ys.map((y) => hEdge(xa, xb, y))];
}

/** Lays text out as 5pt-wide, 10pt-tall chars starting at (x, top). */
export function textChars(text: string, x: number, top: number): Char[] {
  return Array.from(text).map((t, i) => ({
    text: t, size: 10, upright: true,
    x0: x + i * 5, x1: x + i * 5 + 5, top, bottom: top + 10,
  }));
}

export function page(edges: Edge[], chars: Char[], pageNumber = 1): PageContent {
  return { pageNumber, width: 612, height: 792, edges, chars };
}
