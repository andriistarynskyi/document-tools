import type { DetectionMode } from '../core/detect/find-tables';
import type { DocumentResult } from '../core/document/document';
import { assembleSheet, toBlocks, type SheetBlock, type SheetModel } from '../export/sheet-layout';
import { renderPreview } from './preview';
import { setStatus } from './status';

export interface ReviewDialogDeps {
  /** Re-runs detection with another mode on the already loaded file. */
  reanalyze(mode: DetectionMode): Promise<DocumentResult>;
  /** Writes and downloads the sheet. */
  exportSheet(model: SheetModel, sourceName: string): Promise<void>;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

/** The review popup: a preview of the single sheet, a detection-mode switch and the download. */
export class ReviewDialog {
  private readonly dialog = byId<HTMLDialogElement>('dialog');
  private readonly subtitle = byId('dlgSub');
  private readonly status = byId('dlgStatus');
  private readonly preview = byId('preview');
  private readonly modeSelect = byId<HTMLSelectElement>('mode');
  private readonly exportBtn = byId<HTMLButtonElement>('exportBtn');
  private blocks: SheetBlock[] = [];
  private readonly excluded = new Set<string>();
  private sourceName = '';
  private isBusy = false;

  constructor(private readonly deps: ReviewDialogDeps) {
    byId('cancelBtn').addEventListener('click', () => this.dialog.close());
    this.modeSelect.addEventListener('change', () => void this.changeMode(this.modeSelect.value as DetectionMode));
    this.exportBtn.addEventListener('click', () => void this.download());
  }

  open(doc: DocumentResult, sourceName: string): void {
    this.sourceName = sourceName;
    this.modeSelect.value = 'auto';
    setStatus(this.status, null);
    this.show(doc);
    this.dialog.showModal();
  }

  private show(doc: DocumentResult): void {
    this.blocks = toBlocks(doc);
    this.excluded.clear();
    const tables = doc.tables.length;
    this.subtitle.textContent =
      `${this.sourceName} · ${doc.pageCount} page(s) · ${tables} table(s). ` +
      'Everything below goes onto one sheet, in this order.';
    this.render();
  }

  private render(): void {
    renderPreview(this.preview, this.blocks, { excluded: this.excluded, onToggle: (id) => this.toggle(id) });
    const hasTable = this.blocks.some((b) => b.kind === 'table' && !this.excluded.has(b.id));
    this.exportBtn.disabled = this.isBusy || !hasTable;
    this.modeSelect.disabled = this.isBusy;
    if (!this.blocks.some((b) => b.kind === 'table')) {
      setStatus(this.status, 'error', 'No tables found with this detection mode. Try another one.');
    }
  }

  private toggle(id: string): void {
    if (this.excluded.has(id)) this.excluded.delete(id);
    else this.excluded.add(id);
    this.render();
  }

  private async changeMode(mode: DetectionMode): Promise<void> {
    this.isBusy = true;
    this.render();
    setStatus(this.status, 'busy', 'Detecting tables…');
    try {
      const doc = await this.deps.reanalyze(mode);
      setStatus(this.status, null);
      this.isBusy = false;
      this.show(doc);
    } catch (e) {
      console.error(e);
      this.isBusy = false;
      setStatus(this.status, 'error', 'Detection failed. Please try again.');
      this.render();
    }
  }

  private async download(): Promise<void> {
    this.isBusy = true;
    this.render();
    setStatus(this.status, 'busy', 'Building the Excel file…');
    try {
      await this.deps.exportSheet(assembleSheet(this.blocks.filter((b) => !this.excluded.has(b.id))), this.sourceName);
      this.dialog.close();
    } catch (e) {
      console.error(e);
      setStatus(this.status, 'error', 'Export failed. Please try again.');
    } finally {
      this.isBusy = false;
      this.render();
    }
  }
}
