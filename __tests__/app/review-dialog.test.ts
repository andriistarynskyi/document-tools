// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_RELOAD_MESSAGE, isChunkLoadError } from '../../src/app/app-load-error';
import { ReviewDialog, type ReviewDialogDeps } from '../../src/app/review-dialog';
import type { DocumentResult } from '../../src/core/document/document';

// Markup the dialog expects (test fixture; mirrors the ids in index.html).
const MARKUP = `
  <dialog id="dialog"><p id="dlgSub"></p><div id="dlgStatus" hidden></div>
    <select id="mode"><option value="auto">a</option><option value="stream">s</option></select>
    <div id="preview"></div><button id="cancelBtn"></button><button id="exportBtn"></button>
  </dialog>`;

const DOC: DocumentResult = {
  pageCount: 1,
  header: [],
  footer: [],
  tables: [{ pages: [1], rows: [['Item'], ['Bolt']], merges: [], columns: [], top: 0, bottom: 0 }],
};

const chunkError = (): Error => Object.assign(new Error('Loading chunk 974 failed.'), { name: 'ChunkLoadError' });

async function downloadFailingWith(error: Error): Promise<string> {
  const deps: ReviewDialogDeps = { reanalyze: async () => DOC, exportSheet: () => Promise.reject(error) };
  new ReviewDialog(deps).open(DOC, 'quote.pdf');
  document.getElementById('exportBtn')?.click();
  await vi.waitFor(() => expect(document.getElementById('dlgStatus')?.className).toBe('status error'));
  return document.getElementById('dlgStatus')?.textContent ?? '';
}

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  // jsdom does not implement modal dialogs.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.open = false; };
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('isChunkLoadError', () => {
  it('recognises webpack chunk load failures only', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new Error('Cannot merge already merged cells'))).toBe(false);
    expect(isChunkLoadError('ChunkLoadError')).toBe(false);
  });
});

describe('ReviewDialog download errors', () => {
  it('asks for a reload when the Excel writer chunk cannot be loaded', async () => {
    expect(await downloadFailingWith(chunkError())).toBe(APP_RELOAD_MESSAGE);
  });

  it('suggests a retry for other export failures', async () => {
    expect(await downloadFailingWith(new Error('disk full'))).toBe('Export failed. Please try again.');
  });

  it('keeps the dialog open so the user still sees the message', async () => {
    await downloadFailingWith(chunkError());
    expect((document.getElementById('dialog') as HTMLDialogElement).open).toBe(true);
  });
});
