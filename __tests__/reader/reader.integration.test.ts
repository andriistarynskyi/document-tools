import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readPage, type PdfOps, type PdfPageLike } from '../../src/reader/page-reader';

// testFiles/ is git-ignored, so these only run on machines that have the sample PDFs.
const SAMPLE = 'testFiles/sample-tables.pdf';
const QUOTE = 'testFiles/17768124-00.pdf';

async function open(path: string, pageNumber: number) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const page = await doc.getPage(pageNumber);
  return readPage(page as unknown as PdfPageLike, pdfjs.OPS as unknown as PdfOps); // structural subset of pdf.js types
}

describe.skipIf(!existsSync(SAMPLE))('readPage on sample-tables.pdf', () => {
  it('extracts chars inside the page and ruling edges', async () => {
    const content = await open(SAMPLE, 1);
    expect(content.width).toBe(612);
    expect(content.height).toBe(792);
    expect(content.chars.length).toBeGreaterThan(100);
    for (const c of content.chars) {
      expect(c.x0).toBeGreaterThanOrEqual(-1);
      expect(c.x1).toBeLessThanOrEqual(613);
      expect(c.top).toBeGreaterThanOrEqual(-1);
      expect(c.bottom).toBeLessThanOrEqual(793);
    }
    expect(content.edges.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!existsSync(QUOTE))('readPage on 17768124-00.pdf', () => {
  it('finds the stroked ruling lines', async () => {
    const content = await open(QUOTE, 1);
    expect(content.chars.length).toBeGreaterThan(500);
    expect(content.edges.filter((e) => e.orientation === 'h').length).toBeGreaterThan(5);
  });
});
