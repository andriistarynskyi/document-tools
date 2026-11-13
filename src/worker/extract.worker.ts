/// <reference lib="webworker" />
// Registers pdf.js's parser on globalThis.pdfjsWorker, so pdf.js runs it in this thread
// instead of spawning a nested worker. Must be imported before any document is opened.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PageContent } from '../core/geometry/types';
import { analyze, ExtractError, readPdf, type PdfLib } from '../pipeline/extract-document';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const lib = pdfjs as unknown as PdfLib; // pdf.js typings are wider than the structural slice we use

/** Pages of the last file, kept so a mode change does not re-parse the PDF. */
let cachedPages: PageContent[] | null = null;

const post = (msg: WorkerResponse): void => self.postMessage(msg);

async function handle(req: WorkerRequest): Promise<void> {
  if (req.type === 'extract') {
    cachedPages = null;
    cachedPages = await readPdf(lib, new Uint8Array(req.data), (fraction) => post({ type: 'progress', id: req.id, fraction }));
  }
  if (!cachedPages) throw new ExtractError('unknown', 'No document loaded.');
  post({ type: 'result', id: req.id, result: analyze(cachedPages, req.mode) });
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  handle(req).catch((e: unknown) => {
    const error = e instanceof ExtractError ? e : new ExtractError('unknown', String(e));
    if (error.code === 'unknown') console.error('[extract.worker]', e);
    post({ type: 'error', id: req.id, code: error.code, message: error.message });
  });
});
