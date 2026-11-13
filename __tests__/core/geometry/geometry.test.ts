import { describe, expect, it } from 'vitest';
import { getBBoxOverlap, isCentreInside, objectsToBBox } from '../../../src/core/geometry/geometry';

describe('objectsToBBox', () => {
  it('returns the enclosing box', () => {
    const box = objectsToBBox([
      { x0: 10, top: 20, x1: 30, bottom: 40 },
      { x0: 5, top: 25, x1: 50, bottom: 35 },
    ]);
    expect(box).toEqual({ x0: 5, top: 20, x1: 50, bottom: 40 });
  });

  it('throws on empty input', () => {
    expect(() => objectsToBBox([])).toThrow();
  });
});

describe('getBBoxOverlap', () => {
  const a = { x0: 0, top: 0, x1: 10, bottom: 10 };

  it('returns the intersection', () => {
    expect(getBBoxOverlap(a, { x0: 5, top: 5, x1: 20, bottom: 20 })).toEqual({
      x0: 5, top: 5, x1: 10, bottom: 10,
    });
  });

  it('returns null for disjoint boxes', () => {
    expect(getBBoxOverlap(a, { x0: 11, top: 0, x1: 20, bottom: 10 })).toBeNull();
  });

  it('returns a degenerate box for edge contact on one side', () => {
    expect(getBBoxOverlap(a, { x0: 10, top: 0, x1: 20, bottom: 10 })).toEqual({
      x0: 10, top: 0, x1: 10, bottom: 10,
    });
  });

  it('returns null for single-point contact', () => {
    expect(getBBoxOverlap(a, { x0: 10, top: 10, x1: 20, bottom: 20 })).toBeNull();
  });
});

describe('isCentreInside', () => {
  const box = { x0: 0, top: 0, x1: 100, bottom: 100 };
  it('uses the object centre', () => {
    expect(isCentreInside({ x0: 90, top: 10, x1: 110, bottom: 20 }, box)).toBe(false);
    expect(isCentreInside({ x0: 80, top: 10, x1: 110, bottom: 20 }, box)).toBe(true);
  });
});
