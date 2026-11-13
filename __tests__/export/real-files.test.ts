import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { assembleSheet, disjointMerges, toBlocks } from '../../src/export/sheet-layout';
import { writeXlsx } from '../../src/export/xlsx-writer';
import { analyze, readPdf, type PdfLib } from '../../src/pipeline/extract-document';

// testFiles/ is git-ignored; these regression checks run only where the sample PDFs exist.
const FILES = ['17768124-00.pdf', 'Crane supplies 678266 VALVES.pdf', 'sample-tables.pdf']
  .map((name) => `testFiles/${name}`)
  .filter((path) => existsSync(path));
const MODES = ['auto', 'lattice', 'stream'] as const;
const lib = pdfjs as unknown as PdfLib; // structural subset of the pdf.js module

describe.skipIf(FILES.length === 0)('export of the sample PDFs', () => {
  it.each(FILES)('%s exports in every detection mode', async (path) => {
    const pages = await readPdf(lib, new Uint8Array(readFileSync(path)));
    for (const mode of MODES) {
      const buffer = await writeXlsx(assembleSheet(toBlocks(analyze(pages, mode))), path);
      expect(buffer.byteLength).toBeGreaterThan(0);
    }
  }, 60_000);

  it.each(FILES)('%s produces no overlapping merged cells', async (path) => {
    const pages = await readPdf(lib, new Uint8Array(readFileSync(path)));
    for (const table of analyze(pages, 'auto').tables) {
      expect(disjointMerges(table.merges)).toEqual(table.merges);
    }
  }, 60_000);
});
