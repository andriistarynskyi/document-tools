import { describe, expect, it } from 'vitest';
import type { Char } from '../../../src/core/geometry/types';
import { charsToWords, extractText } from '../../../src/core/text/words';

/** Lays out `text` as 5pt-wide chars starting at (x, top), 10pt tall. */
function chars(text: string, x: number, top: number): Char[] {
  return Array.from(text).map((t, i) => ({
    text: t, size: 10, upright: true,
    x0: x + i * 5, x1: x + i * 5 + 5, top, bottom: top + 10,
  }));
}

describe('charsToWords', () => {
  it('splits on whitespace chars', () => {
    expect(charsToWords(chars('ab cd', 0, 0)).map((w) => w.text)).toEqual(['ab', 'cd']);
  });

  it('splits when the horizontal gap exceeds the tolerance', () => {
    const input = [...chars('ab', 0, 0), ...chars('cd', 20, 0)]; // gap = 10
    expect(charsToWords(input).map((w) => w.text)).toEqual(['ab', 'cd']);
  });

  it('keeps chars within the tolerance together', () => {
    const input = [...chars('ab', 0, 0), ...chars('cd', 12, 0)]; // gap = 2
    expect(charsToWords(input).map((w) => w.text)).toEqual(['abcd']);
  });

  it('reads chars left to right regardless of input order', () => {
    expect(charsToWords(chars('abc', 0, 0).reverse()).map((w) => w.text)).toEqual(['abc']);
  });

  it('computes the word bounding box', () => {
    const [w] = charsToWords(chars('abc', 10, 20));
    expect(w).toMatchObject({ x0: 10, x1: 25, top: 20, bottom: 30 });
  });
});

describe('extractText', () => {
  it('joins words with spaces and lines with newlines', () => {
    const input = [...chars('hello world', 0, 0), ...chars('second', 0, 20)];
    expect(extractText(input)).toBe('hello world\nsecond');
  });

  it('treats small vertical jitter as the same line', () => {
    const input = [...chars('ab', 0, 0), ...chars('cd', 30, 1.5)];
    expect(extractText(input)).toBe('ab cd');
  });

  it('returns an empty string for no chars', () => {
    expect(extractText([])).toBe('');
  });
});
