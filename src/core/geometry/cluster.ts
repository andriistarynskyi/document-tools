/*
 * Ported from pdfplumber (https://github.com/jsvine/pdfplumber), utils/clustering.py.
 * pdfplumber is MIT licensed. Copyright (c) 2015 Jeremy Singer-Vine.
 * See the license banner emitted into the production bundle.
 */

/**
 * Groups sorted numbers into clusters where each value is within `tolerance`
 * of the previous one. With tolerance 0 every distinct entry is its own cluster.
 */
export function clusterList(values: readonly number[], tolerance = 0): number[][] {
  const sorted = [...values].sort((a, b) => a - b);
  if (tolerance === 0 || sorted.length < 2) return sorted.map((v) => [v]);

  const groups: number[][] = [];
  let current: number[] = [sorted[0]];
  let last = sorted[0];
  for (const v of sorted.slice(1)) {
    if (v <= last + tolerance) {
      current.push(v);
    } else {
      groups.push(current);
      current = [v];
    }
    last = v;
  }
  groups.push(current);
  return groups;
}

/** Maps every value to the index of the cluster it belongs to. */
function makeClusterIndex(values: readonly number[], tolerance: number): Map<number, number> {
  const clusters = clusterList([...new Set(values)], tolerance);
  const index = new Map<number, number>();
  clusters.forEach((cluster, i) => cluster.forEach((v) => index.set(v, i)));
  return index;
}

/**
 * Groups objects whose `key(obj)` values fall in the same tolerance cluster.
 * Groups are returned ordered by ascending key; order inside a group is preserved.
 */
export function clusterObjects<T>(
  items: readonly T[],
  key: (item: T) => number,
  tolerance: number,
): T[][] {
  const index = makeClusterIndex(items.map(key), tolerance);
  const buckets = new Map<number, T[]>();
  for (const item of items) {
    const i = index.get(key(item));
    if (i === undefined) continue;
    const bucket = buckets.get(i);
    if (bucket) bucket.push(item);
    else buckets.set(i, [item]);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group);
}
