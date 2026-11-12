import { describe, expect, it } from 'vitest';
import { findRunningContent, normalizeKey } from '../../../src/core/document/running';
import { gridTable, pageLine, summary } from '../../helpers/synthetic-doc';

const XS = [50, 200, 350];

function threePages(extra: (page: number) => ReturnType<typeof pageLine>[] = () => []) {
  return [1, 2, 3].map((n) =>
    summary(n, [gridTable(n, [[`row ${n}`, 'x']], XS, 300)], [
      pageLine(['ACME Supplies Ltd'], 20),
      pageLine([`Page ${n} of 3`], 760),
      ...extra(n),
    ]),
  );
}

describe('normalizeKey', () => {
  it('ignores digits, case and spacing', () => {
    expect(normalizeKey('Page 1  of 3')).toBe(normalizeKey('page 12 of 30'));
  });
});

describe('findRunningContent', () => {
  it('returns the header from the first page and the footer from the last page', () => {
    const running = findRunningContent(threePages());
    expect(running.header).toEqual([['ACME Supplies Ltd']]);
    expect(running.footer).toEqual([['Page 3 of 3']]);
  });

  it('marks running lines on every page they appear on', () => {
    expect(findRunningContent(threePages()).runningLines.size).toBe(6);
  });

  it('ignores lines that appear on too few pages', () => {
    const pages = threePages((n) => (n === 1 ? [pageLine(['Draft'], 40)] : []));
    expect(findRunningContent(pages).header).toEqual([['ACME Supplies Ltd']]);
  });

  it('ignores repeated text at different positions', () => {
    const pages = [1, 2, 3].map((n) => summary(n, [], [pageLine(['Notes'], 20 + n * 30)]));
    expect(findRunningContent(pages).header).toEqual([]);
  });

  it('keeps data tables that differ only in their numbers', () => {
    const pages = [1, 2].map((n) => summary(n, [gridTable(n, [['Total', String(n * 100)]], XS, 40)]));
    expect(findRunningContent(pages).runningTables.size).toBe(0);
  });

  it('treats a table repeated on every page as header content', () => {
    const box = (n: number) => gridTable(n, [['Customer #:', '505079'], ['Date:', '10/21/2026']], XS, 40);
    const pages = [1, 2].map((n) => summary(n, [box(n)]));
    const running = findRunningContent(pages);
    expect(running.header).toEqual([['Customer #:', '505079'], ['Date:', '10/21/2026']]);
    expect(running.runningTables.size).toBe(2);
  });

  it('does not pull repeated text from the middle of the page', () => {
    const pages = [1, 2].map((n) => summary(n, [], [pageLine(['Section A'], 400)]));
    const running = findRunningContent(pages);
    expect(running.header).toEqual([]);
    expect(running.footer).toEqual([]);
  });

  it('finds nothing in a single-page document', () => {
    const running = findRunningContent([summary(1, [], [pageLine(['ACME'], 20)])]);
    expect(running.header).toEqual([]);
  });
});
