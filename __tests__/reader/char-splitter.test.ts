import { describe, expect, it } from 'vitest';
import type { Matrix } from '../../src/core/geometry/matrix';
import { splitRun } from '../../src/reader/char-splitter';

// Letter page, no rotation: y flips (top = 792 - y).
const VIEWPORT: Matrix = [1, 0, 0, -1, 0, 792];

describe('splitRun', () => {
  const run = { str: 'Total', width: 50, height: 10, transform: [10, 0, 0, 10, 100, 700] };

  it('produces one char per glyph', () => {
    expect(splitRun(run, VIEWPORT).map((c) => c.text).join('')).toBe('Total');
  });

  it('keeps the run edges exact', () => {
    const chars = splitRun(run, VIEWPORT);
    expect(chars[0].x0).toBeCloseTo(100);
    expect(chars[chars.length - 1].x1).toBeCloseTo(150);
  });

  it('lays chars out contiguously without overlap', () => {
    const chars = splitRun(run, VIEWPORT);
    for (let i = 1; i < chars.length; i++) {
      expect(chars[i].x0).toBeCloseTo(chars[i - 1].x1);
    }
  });

  it('converts to top-left origin', () => {
    const [c] = splitRun(run, VIEWPORT);
    expect(c.bottom).toBeCloseTo(92); // 792 - baseline 700
    expect(c.top).toBeCloseTo(82); // baseline + font size 10
    expect(c.upright).toBe(true);
  });

  it('flags rotated text as not upright', () => {
    const rotated = { ...run, transform: [0, 10, -10, 0, 100, 700] };
    expect(splitRun(rotated, VIEWPORT)[0].upright).toBe(false);
  });

  it('ignores empty runs', () => {
    expect(splitRun({ ...run, str: '', width: 0 }, VIEWPORT)).toEqual([]);
  });
});
