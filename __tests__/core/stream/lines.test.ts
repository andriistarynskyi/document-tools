import { describe, expect, it } from 'vitest';
import { buildLines, isTabularLine } from '../../../src/core/stream/lines';
import { lineWords, textLines } from '../../helpers/synthetic-lines';

describe('buildLines', () => {
  it('groups words into lines top to bottom', () => {
    const lines = buildLines([...lineWords(200, [[50, 'second']]), ...lineWords(100, [[50, 'first']])]);
    expect(lines.map((l) => l.words[0].text)).toEqual(['first', 'second']);
  });

  it('keeps words separated by normal spacing in one segment', () => {
    const [line] = textLines([[[50, 'Product and description']]]);
    expect(line.segments).toHaveLength(1);
    expect(line.segments[0].text).toBe('Product and description');
  });

  it('splits segments at wide gaps', () => {
    const [line] = textLines([[[50, 'Bolt M8'], [200, '12'], [300, '4.50']]]);
    expect(line.segments.map((s) => s.text)).toEqual(['Bolt M8', '12', '4.50']);
  });
});

describe('isTabularLine', () => {
  it('is true for two or more segments', () => {
    expect(isTabularLine(textLines([[[50, 'a'], [200, 'b']]])[0])).toBe(true);
    expect(isTabularLine(textLines([[[50, 'one long sentence of prose']]])[0])).toBe(false);
  });
});
