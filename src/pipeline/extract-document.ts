import type { DetectionMode } from '../core/detect/find-tables';
import { buildDocument, type DocumentResult } from '../core/document/document';
import { summarizePage } from '../core/document/page-summary';
import type { PageContent } from '../core/geometry/types';
import { readPage, type PdfOps, type PdfPageLike } from '../reader/page-reader';

/** Hard limits that keep a hostile or huge file from exhausting the browser. */
export const MAX_PAGES = 1000;

/** The slice of the pdf.js module the pipeline uses, injected so it runs in a worker or in Node. */
export interface PdfLib {
  OPS: PdfOps;
  getDocument(src: { data: Uint8Array; verbosity?: number }): {
    promise: Promise<PdfDocLike>;
    destroy(): Promise<void>;
  };
}

interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike & { cleanup(): void }>;
}

export type ExtractErrorCode = 'password' | 'invalid' | 'no-text' | 'unknown';

export class ExtractError extends Error {
  constructor(readonly code: ExtractErrorCode, message: string) {
    super(message);
    this.name = 'ExtractError';
  }
}

/** pdf.js signals bad input through exception names; map them to user-facing codes. */
function classify(e: unknown): ExtractError {
  if (e instanceof ExtractError) return e;
  const name = e instanceof Error ? e.name : '';
  if (name === 'PasswordException') return new ExtractError('password', 'This PDF is password protected.');
  if (name === 'InvalidPDFException' || name === 'FormatError') {
    return new ExtractError('invalid', 'This file is not a valid PDF or it is damaged.');
  }
  return new ExtractError('unknown', e instanceof Error ? e.message : String(e));
}

/** Parses every page (up to MAX_PAGES) into PageContent. `onProgress` gets 0..1. */
export async function readPdf(
  lib: PdfLib,
  data: Uint8Array,
  onProgress?: (fraction: number) => void,
): Promise<PageContent[]> {
  const task = lib.getDocument({ data, verbosity: 0 });
  try {
    const doc = await task.promise;
    const count = Math.min(doc.numPages, MAX_PAGES);
    const pages: PageContent[] = [];
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      try {
        pages.push(await readPage(page, lib.OPS));
      } finally {
        page.cleanup();
      }
      onProgress?.(n / count);
    }
    if (pages.every((p) => p.chars.length === 0)) {
      throw new ExtractError('no-text', 'This PDF has no selectable text (it is probably a scan).');
    }
    return pages;
  } catch (e) {
    throw classify(e);
  } finally {
    await task.destroy();
  }
}

/** Runs table detection and document assembly. Cheap enough to re-run when the mode changes. */
export function analyze(pages: readonly PageContent[], mode: DetectionMode): DocumentResult {
  return buildDocument(pages.map((p) => summarizePage(p, mode)));
}
