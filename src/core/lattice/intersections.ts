/*
 * Ported from pdfplumber (https://github.com/jsvine/pdfplumber), table.py
 * (edges_to_intersections).
 * pdfplumber is MIT licensed. Copyright (c) 2015 Jeremy Singer-Vine.
 * See the license banner emitted into the production bundle.
 */
import type { Edge } from '../geometry/types';

export interface Vertex {
  x: number;
  y: number;
  /** Vertical edges passing through this vertex. */
  v: Edge[];
  /** Horizontal edges passing through this vertex. */
  h: Edge[];
}

/** Vertices keyed by `vertexKey(x, y)`. */
export type Intersections = Map<string, Vertex>;

export const vertexKey = (x: number, y: number): string => `${x},${y}`;

export interface IntersectionTolerances {
  x: number;
  y: number;
}

/** Every point where a vertical edge crosses or touches a horizontal edge. */
export function edgesToIntersections(
  edges: readonly Edge[],
  tol: IntersectionTolerances,
): Intersections {
  const vs = edges.filter((e) => e.orientation === 'v');
  const hs = edges.filter((e) => e.orientation === 'h');
  const found: Intersections = new Map();

  for (const v of vs) {
    for (const h of hs) {
      const crosses =
        v.top <= h.top + tol.y &&
        v.bottom >= h.top - tol.y &&
        v.x0 >= h.x0 - tol.x &&
        v.x0 <= h.x1 + tol.x;
      if (!crosses) continue;
      const key = vertexKey(v.x0, h.top);
      let vertex = found.get(key);
      if (!vertex) {
        vertex = { x: v.x0, y: h.top, v: [], h: [] };
        found.set(key, vertex);
      }
      vertex.v.push(v);
      vertex.h.push(h);
    }
  }
  return found;
}
