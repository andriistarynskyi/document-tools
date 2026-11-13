/*
 * Ported from pdfplumber (https://github.com/jsvine/pdfplumber), table.py and utils/geometry.py
 * (snap_edges, join_edge_group, merge_edges, filter_edges).
 * pdfplumber is MIT licensed. Copyright (c) 2015 Jeremy Singer-Vine.
 * See the license banner emitted into the production bundle.
 */
import { clusterObjects } from '../geometry/cluster';
import type { Edge } from '../geometry/types';

export interface MergeTolerances {
  snapX: number;
  snapY: number;
  joinX: number;
  joinY: number;
}

/** Moves every edge in a cluster onto the cluster's mean position (exact, no float drift). */
function snapGroup(edges: Edge[], orientation: 'h' | 'v', tolerance: number): Edge[] {
  const key = (e: Edge) => (orientation === 'v' ? e.x0 : e.top);
  return clusterObjects(edges, key, tolerance).flatMap((cluster) => {
    const mean = cluster.reduce((s, e) => s + key(e), 0) / cluster.length;
    return cluster.map((e) =>
      orientation === 'v' ? { ...e, x0: mean, x1: mean } : { ...e, top: mean, bottom: mean },
    );
  });
}

export function snapEdges(edges: readonly Edge[], tolX: number, tolY: number): Edge[] {
  const v = snapGroup(edges.filter((e) => e.orientation === 'v'), 'v', tolX);
  const h = snapGroup(edges.filter((e) => e.orientation === 'h'), 'h', tolY);
  return [...v, ...h];
}

/** Joins collinear edges that touch or overlap (within `tolerance`) into longer edges. */
function joinEdgeGroup(edges: Edge[], orientation: 'h' | 'v', tolerance: number): Edge[] {
  const lo = (e: Edge) => (orientation === 'h' ? e.x0 : e.top);
  const hi = (e: Edge) => (orientation === 'h' ? e.x1 : e.bottom);
  const sorted = [...edges].sort((a, b) => lo(a) - lo(b));
  const joined: Edge[] = [sorted[0]];
  for (const e of sorted.slice(1)) {
    const last = joined[joined.length - 1];
    if (lo(e) > hi(last) + tolerance) {
      joined.push(e);
    } else if (hi(e) > hi(last)) {
      joined[joined.length - 1] =
        orientation === 'h'
          ? { ...last, x1: e.x1, width: e.x1 - last.x0 }
          : { ...last, bottom: e.bottom, height: e.bottom - last.top };
    }
  }
  return joined;
}

export function mergeEdges(edges: readonly Edge[], tol: MergeTolerances): Edge[] {
  const snapped = tol.snapX > 0 || tol.snapY > 0 ? snapEdges(edges, tol.snapX, tol.snapY) : [...edges];
  const groups = new Map<string, Edge[]>();
  for (const e of snapped) {
    const k = `${e.orientation}:${e.orientation === 'v' ? e.x0 : e.top}`;
    const g = groups.get(k);
    if (g) g.push(e);
    else groups.set(k, [e]);
  }
  const out: Edge[] = [];
  for (const group of groups.values()) {
    const orientation = group[0].orientation;
    out.push(...joinEdgeGroup(group, orientation, orientation === 'h' ? tol.joinX : tol.joinY));
  }
  return out;
}

/** Drops edges shorter than `minLength` along their own axis. */
export function filterEdges(edges: readonly Edge[], minLength: number): Edge[] {
  return edges.filter((e) => (e.orientation === 'h' ? e.width : e.height) >= minLength);
}
