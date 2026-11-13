import './styles.css';
import { download, xlsxName } from './app/download';
import { ClientError, ExtractClient } from './app/extract-client';
import { ReviewDialog } from './app/review-dialog';
import { setProgress, setStatus } from './app/status';
import type { SheetModel } from './export/sheet-layout';

const MAX_SIZE_MB = 10;
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const drop = byId<HTMLLabelElement>('drop');
const input = byId<HTMLInputElement>('file');
const fileName = byId('fileName');
const status = byId('status');

const client = new ExtractClient();
let isAnalyzing = false; // ignore new files while one is being processed

async function exportSheet(model: SheetModel, sourceName: string): Promise<void> {
  // ExcelJS is large; load it only when the user actually downloads.
  const { writeXlsx, XLSX_MIME } = await import('./export/xlsx-writer');
  const buffer = await writeXlsx(model, sourceName);
  download(new Blob([buffer], { type: XLSX_MIME }), xlsxName(sourceName));
}

const dialog = new ReviewDialog({ reanalyze: (mode) => client.analyze(mode), exportSheet });

function isPdf(file: File): boolean {
  // Trust the browser-reported MIME first; fall back to the extension when it is blank.
  if (file.type) return file.type === 'application/pdf';
  return /\.pdf$/i.test(file.name);
}

function validate(file: File): string | null {
  if (!isPdf(file)) return 'Only PDF files are supported. Please choose a .pdf file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_SIZE) return `File is ${(file.size / 1048576).toFixed(1)} MB, over the ${MAX_SIZE_MB} MB limit.`;
  return null;
}

function errorMessage(e: unknown): string {
  if (e instanceof ClientError && e.code !== 'unknown') return e.message;
  console.error(e);
  return 'Could not read this PDF. It may be damaged.';
}

async function handleFile(file: File | undefined): Promise<void> {
  if (!file || isAnalyzing) return;
  fileName.textContent = file.name;
  const problem = validate(file);
  if (problem) return setStatus(status, 'error', problem);

  isAnalyzing = true;
  setProgress(status, 0, 'Reading PDF…');
  try {
    const doc = await client.extract(await file.arrayBuffer(), 'auto', (f) => setProgress(status, f, 'Reading PDF…'));
    if (!doc.tables.length) {
      return setStatus(status, 'error', `No tables found in "${file.name}" (${doc.pageCount} page(s)).`);
    }
    // The review dialog shows the page and table counts, so the upload card needs no message.
    setStatus(status, null);
    dialog.open(doc, file.name);
  } catch (e) {
    setStatus(status, 'error', errorMessage(e));
  } finally {
    isAnalyzing = false;
  }
}

input.addEventListener('change', () => {
  const file = input.files?.[0];
  input.value = ''; // allow re-selecting the same file
  void handleFile(file);
});

drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    input.click();
  }
});
for (const ev of ['dragenter', 'dragover'] as const) {
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
}
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  void handleFile(e.dataTransfer?.files[0]);
});

// Offline support: service workers need https (localhost over http is skipped on purpose,
// so the dev server never serves stale cached files).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker failed', e));
  });
}
