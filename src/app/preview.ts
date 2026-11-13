import type { SheetBlock } from '../export/sheet-layout';

/** Long tables are cut in the preview only; the export always has every row. */
export const PREVIEW_ROW_LIMIT = 200;

export interface PreviewOptions {
  excluded: ReadonlySet<string>;
  onToggle(id: string): void;
}

interface Span {
  rowSpan: number;
  colSpan: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // PDF text is untrusted: never set as HTML
  return node;
}

/** Start cell -> span, and the set of grid positions hidden under a merged cell. */
function mergeLayout(block: SheetBlock, rowLimit: number): { spans: Map<string, Span>; covered: Set<string> } {
  const spans = new Map<string, Span>();
  const covered = new Set<string>();
  for (const m of block.merges) {
    if (m.row >= rowLimit) continue;
    const rowSpan = Math.min(m.rowSpan, rowLimit - m.row);
    spans.set(`${m.row},${m.col}`, { rowSpan, colSpan: m.colSpan });
    for (let r = m.row; r < m.row + rowSpan; r++) {
      for (let c = m.col; c < m.col + m.colSpan; c++) if (r !== m.row || c !== m.col) covered.add(`${r},${c}`);
    }
  }
  return { spans, covered };
}

function renderGrid(block: SheetBlock): HTMLElement {
  const limit = Math.min(block.rows.length, PREVIEW_ROW_LIMIT);
  const width = Math.max(1, ...block.rows.map((r) => r.length));
  const { spans, covered } = mergeLayout(block, limit);
  const table = el('table', 'sheet');
  const body = el('tbody');
  for (let r = 0; r < limit; r++) {
    const tr = el('tr');
    const isBold = block.boldRows.includes(r);
    for (let c = 0; c < width; c++) {
      if (covered.has(`${r},${c}`)) continue;
      const cell = isBold ? el('th', undefined, block.rows[r][c] ?? '') : el('td', undefined, block.rows[r][c] ?? '');
      if (isBold) cell.setAttribute('scope', 'col');
      const span = spans.get(`${r},${c}`);
      if (span) {
        cell.rowSpan = span.rowSpan;
        cell.colSpan = span.colSpan;
      }
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(body);
  return table;
}

function renderBlock(block: SheetBlock, options: PreviewOptions): HTMLElement {
  const isIncluded = !options.excluded.has(block.id);
  const section = el('section', isIncluded ? 'block' : 'block excluded');
  const headingId = `block-${block.id}`;
  section.setAttribute('aria-labelledby', headingId);

  const bar = el('div', 'block-bar');
  const heading = el('h3', undefined, block.title);
  heading.id = headingId;
  const toggle = el('button', 'btn small', isIncluded ? 'Included' : 'Excluded');
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', String(isIncluded));
  toggle.setAttribute('aria-label', `Include ${block.title} in the download`);
  toggle.addEventListener('click', () => options.onToggle(block.id));
  bar.append(heading, toggle);
  section.append(bar);
  if (!isIncluded) return section;

  const scroller = el('div', 'table-scroll');
  scroller.tabIndex = 0; // keyboard users can scroll wide tables
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', block.title);
  scroller.append(renderGrid(block));
  section.append(scroller);
  const hidden = block.rows.length - PREVIEW_ROW_LIMIT;
  if (hidden > 0) section.append(el('p', 'muted more', `${hidden} more rows are not shown here but will be downloaded.`));
  return section;
}

/** Renders the sheet the user is about to download, block by block. */
export function renderPreview(container: HTMLElement, blocks: readonly SheetBlock[], options: PreviewOptions): void {
  container.replaceChildren(...blocks.map((b) => renderBlock(b, options)));
}
