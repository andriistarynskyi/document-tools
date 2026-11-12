import { describe, expect, it } from 'vitest';
import { clusterList, clusterObjects } from '../../../src/core/geometry/cluster';

describe('clusterList', () => {
  it('returns singletons for tolerance 0', () => {
    expect(clusterList([3, 1, 2], 0)).toEqual([[1], [2], [3]]);
  });

  it('groups values chained within tolerance', () => {
    expect(clusterList([1, 2, 3, 10, 11, 20], 1)).toEqual([[1, 2, 3], [10, 11], [20]]);
  });

  it('chains on the previous value, not the group start', () => {
    // 0 -> 2 -> 4 -> 6 are each within 2 of the previous one
    expect(clusterList([0, 2, 4, 6], 2)).toEqual([[0, 2, 4, 6]]);
  });

  it('handles empty and single inputs', () => {
    expect(clusterList([], 3)).toEqual([]);
    expect(clusterList([5], 3)).toEqual([[5]]);
  });
});

describe('clusterObjects', () => {
  it('groups objects by key tolerance in ascending key order', () => {
    const items = [
      { id: 'c', y: 100 },
      { id: 'a', y: 10 },
      { id: 'b', y: 11.5 },
    ];
    const groups = clusterObjects(items, (i) => i.y, 2);
    expect(groups.map((g) => g.map((i) => i.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('keeps objects with identical keys together', () => {
    const items = [{ id: 1, y: 5 }, { id: 2, y: 5 }, { id: 3, y: 50 }];
    const groups = clusterObjects(items, (i) => i.y, 0);
    expect(groups.map((g) => g.map((i) => i.id))).toEqual([[1, 2], [3]]);
  });
});
