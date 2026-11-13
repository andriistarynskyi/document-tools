import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyze, ExtractError, readPdf, type PdfLib } from '../../src/pipeline/extract-document';
import { drawLinedTable, makePdf } from '../helpers/make-pdf';

const lib = pdfjs as unknown as PdfLib; // structural subset of the pdf.js module

async function errorOf(promise: Promise<unknown>): Promise<ExtractError> {
  try {
    await promise;
  } catch (e) {
    return e as ExtractError;
  }
  throw new Error('expected a rejection');
}

describe('readPdf', () => {
  it('reads every page and reports progress up to 1', async () => {
    const bytes = await makePdf([(c) => c.text('one', 50, 50), (c) => c.text('two', 50, 50)]);
    const progress: number[] = [];
    const pages = await readPdf(lib, bytes, (f) => progress.push(f));
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2]);
    expect(progress).toEqual([0.5, 1]);
  });

  it('rejects non-PDF bytes as invalid', async () => {
    const error = await errorOf(readPdf(lib, new TextEncoder().encode('not a pdf at all')));
    expect(error).toBeInstanceOf(ExtractError);
    expect(error.code).toBe('invalid');
  });

  it('rejects PDFs without any text as no-text', async () => {
    const bytes = await makePdf([(c) => c.line(50, 50, 300, 50)]);
    expect((await errorOf(readPdf(lib, bytes))).code).toBe('no-text');
  });
});

describe('analyze', () => {
  it('runs detection in the requested mode', async () => {
    const bytes = await makePdf([(c) => drawLinedTable(c, [50, 200, 350], [100, 125, 150], [['a', 'b'], ['c', 'd']])]);
    const pages = await readPdf(lib, bytes);
    expect(analyze(pages, 'auto').tables).toHaveLength(1);
    expect(analyze(pages, 'stream').tables).toHaveLength(0);
  });
});
