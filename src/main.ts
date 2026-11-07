import './styles.css';
import { extractTables, isPasswordError, type DetectedTable } from './pdf-tables';
import { exportTables } from './export';

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
const dialog = byId<HTMLDialogElement>('dialog');
const list = byId('list');
const dlgSub = byId('dlgSub');
const exportBtn = byId<HTMLButtonElement>('exportBtn');

let tables: DetectedTable[] = [];
let sourceName = '';
let analyzing = false; // ignore new files while a PDF is being processed

function setStatus(kind: 'busy' | 'error' | 'ok' | null, message = ''): void {
  status.hidden = kind === null;
  status.className = `status ${kind ?? ''}`;
  status.replaceChildren();
  if (kind === 'busy') {
    const s = document.createElement('div');
    s.className = 'spinner';
    status.append(s);
  }
  status.append(document.createTextNode(message));
}

/** Shows a determinate progress bar while a (larger) PDF is analyzed. */
function setProgress(fraction: number, message: string): void {
  status.hidden = false;
  status.className = 'status busy';
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  const label = document.createElement('div');
  label.className = 'progress-label';
  label.textContent = `${message} ${pct}%`;

  const track = document.createElement('div');
  track.className = 'progress';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(pct));
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = `${pct}%`;
  track.append(fill);

  status.replaceChildren(label, track);
}

/** Back to the initial screen. */
function resetState(): void {
  tables = [];
  sourceName = '';
  list.replaceChildren();
  fileName.textContent = 'No file selected';
  setStatus(null);
}

function isPdf(file: File): boolean {
  // Trust the browser-reported MIME first; fall back to extension when it's blank/generic.
  if (file.type) return file.type === 'application/pdf';
  return /\.pdf$/i.test(file.name);
}

function validate(file: File): string | null {
  if (!isPdf(file)) return 'Only PDF files are supported. Please choose a .pdf file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_SIZE) {
    return `File is ${(file.size / 1048576).toFixed(1)} MB, over the ${MAX_SIZE_MB} MB limit.`;
  }
  return null;
}

async function handleFile(file: File | undefined): Promise<void> {
  if (!file || analyzing) return;

  tables = [];
  sourceName = '';
  fileName.textContent = file.name;

  const problem = validate(file);
  if (problem) return setStatus('error', problem);

  analyzing = true;
  setProgress(0, 'Analyzing PDF…');
  try {
    const buffer = await file.arrayBuffer();
    const result = await extractTables(buffer, (fraction) => setProgress(fraction, 'Analyzing PDF…'));
    if (!result.tables.length) {
      return setStatus('error', `No tables found in ${result.pages} page(s). Scanned PDFs (images) are not supported.`);
    }
    tables = result.tables;
    sourceName = file.name;
    setStatus('ok', `Found ${tables.length} table(s) in ${result.pages} page(s).`);
    openDialog(result.pages);
  } catch (e) {
    console.error(e);
    setStatus(
      'error',
      isPasswordError(e)
        ? 'This PDF is password protected.'
        : 'Could not read this PDF. It may be corrupted.',
    );
  } finally {
    analyzing = false;
  }
}

function tableItem(t: DetectedTable): HTMLLIElement {
  const li = document.createElement('li');
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = true;
  cb.value = String(t.id);
  cb.addEventListener('change', updateExportState);

  const info = document.createElement('div');
  info.className = 'info';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = `Table ${t.id} · page ${t.page} · ${t.rows.length} rows × ${t.rows[0].length} cols`;
  const preview = document.createElement('div');
  preview.className = 'preview';
  preview.textContent = t.rows[0].filter(Boolean).join(' | ');

  info.append(title, preview);
  label.append(cb, info);
  li.append(label);
  return li;
}

function openDialog(pages: number): void {
  dlgSub.textContent = `${sourceName} · ${pages} page(s). Each selected table becomes its own sheet.`;
  list.replaceChildren(...tables.map(tableItem));
  updateExportState();
  dialog.showModal();
}

function selectedTables(): DetectedTable[] {
  const ids = new Set(
    [...list.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => Number(i.value)),
  );
  return tables.filter((t) => ids.has(t.id));
}

function updateExportState(): void {
  const n = selectedTables().length;
  exportBtn.disabled = n === 0;
  exportBtn.textContent = n ? `Export ${n} to XLSX` : 'Export to XLSX';
}

async function handleExport(): Promise<void> {
  exportBtn.disabled = true; // prevent double clicks while the workbook is built
  exportBtn.textContent = 'Exporting…';
  try {
    await exportTables(selectedTables(), sourceName);
    dialog.close();
    resetState();
  } catch (e) {
    console.error(e);
    dialog.close();
    setStatus('error', 'Export failed. Please try again.');
  } finally {
    updateExportState();
  }
}

exportBtn.addEventListener('click', () => void handleExport());

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
