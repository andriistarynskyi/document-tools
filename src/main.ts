import './styles.css';
import { byId } from './app/dom';
import { download, xlsxName } from './app/download';
import { describeError, ExtractClient } from './app/extract-client';
import { ReviewDialog } from './app/review-dialog';
import { setProgress, setStatus } from './app/status';
import { validateFile } from './app/validate-file';
import type { SheetModel } from './export/sheet-layout';

const drop = byId<HTMLLabelElement>('drop');
const input = byId<HTMLInputElement>('file');
const fileName = byId('fileName');
const status = byId('status');

/** Created on the first file: the worker pulls in pdf.js (~1.7 MB), which visitors who never upload do not need. */
let client: ExtractClient | null = null;
const getClient = (): ExtractClient => (client ??= new ExtractClient());
let isAnalyzing = false; // ignore new files while one is being processed

async function exportSheet(model: SheetModel, sourceName: string): Promise<void> {
  // ExcelJS is large; load it only when the user actually downloads.
  const { writeXlsx, XLSX_MIME } = await import('./export/xlsx-writer');
  const buffer = await writeXlsx(model, sourceName);
  download(new Blob([buffer], { type: XLSX_MIME }), xlsxName(sourceName));
}

const dialog = new ReviewDialog({ reanalyze: (mode) => getClient().analyze(mode), exportSheet });

async function handleFile(file: File | undefined): Promise<void> {
  if (!file || isAnalyzing) return;
  fileName.textContent = file.name;
  const problem = validateFile(file);
  if (problem) return setStatus(status, 'error', problem);

  isAnalyzing = true;
  setProgress(status, 0, 'Reading PDF…');
  try {
    const doc = await getClient().extract(await file.arrayBuffer(), 'auto', (f) => setProgress(status, f, 'Reading PDF…'));
    if (!doc.tables.length) {
      return setStatus(status, 'error', `No tables found in "${file.name}" (${doc.pageCount} page(s)).`);
    }
    // The review dialog shows the page and table counts, so the upload card needs no message.
    setStatus(status, null);
    dialog.open(doc, file.name);
  } catch (e) {
    setStatus(status, 'error', describeError(e));
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
