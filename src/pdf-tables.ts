// Legacy build: broad browser support (incl. older mobile Safari/Chrome).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Worker is copied next to index.html by webpack (offline friendly).
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

export interface DetectedTable {
  id: number;
  page: number;
  rows: string[][];
}

interface Cell {
  text: string;
  x0: number;
  x1: number;
}

interface Line {
  y: number;
  height: number;
  cells: Cell[];
}

const MIN_ROWS = 3;
const MIN_COLS = 2;
const MAX_AVG_CELL_LENGTH = 50; // filters out multi-column prose

// Guard rails against pathological inputs (within the 10 MB cap a PDF can still be adversarial).
const MAX_PAGES = 1000;
const MAX_ITEMS_PER_PAGE = 50_000; // skip detection on a page with an absurd text-item count

/** Yields to the event loop so the main thread can repaint (progress bar) and stay responsive. */
const yieldToUI = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export function isPasswordError(e: unknown): boolean {
  return e instanceof Error && e.name === 'PasswordException';
}

export interface ExtractResult {
  tables: DetectedTable[];
  pages: number;
}

/** Reports work done so far (0..1). Called once per page, after loading completes. */
export type ProgressCallback = (fraction: number) => void;

/** Extracts tables from all pages. Rejects if the PDF can't be parsed (corrupt, encrypted). */
export async function extractTables(data: ArrayBuffer, onProgress?: ProgressCallback): Promise<ExtractResult> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    // inside try: the task (and its worker resources) must be destroyed even if loading fails
    const doc = await task.promise;
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    const tables: DetectedTable[] = [];
    for (let p = 1; p <= pageCount; p++) {
      const page = await doc.getPage(p);
      try {
        const content = await page.getTextContent();
        const items = content.items.filter(
          (i): i is TextItem => 'str' in i && i.str.trim().length > 0,
        );
        // pdf.js parses off-thread; detection below is synchronous, so bound it per page.
        if (items.length <= MAX_ITEMS_PER_PAGE) {
          for (const rows of findTables(buildLines(items))) {
            tables.push({ id: tables.length + 1, page: p, rows });
          }
        }
      } finally {
        page.cleanup();
      }
      onProgress?.(p / pageCount);
      await yieldToUI(); // let the browser repaint between pages
    }
    return { tables, pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

/** Group text items into visual lines, then split each line into cells by horizontal gaps. */
function buildLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const y = item.transform[5];
    const h = item.height || 10;
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].transform[5] - y) <= h * 0.4) last.push(item);
    else groups.push([item]);
  }

  return groups.map((g) => {
    g.sort((a, b) => a.transform[4] - b.transform[4]);
    const height = Math.max(...g.map((i) => i.height || 10));
    const gapLimit = height * 0.9;
    const cells: Cell[] = [];
    for (const it of g) {
      const x0 = it.transform[4];
      const x1 = x0 + it.width;
      const prev = cells[cells.length - 1];
      if (prev && x0 - prev.x1 <= gapLimit) {
        const space = x0 - prev.x1 > height * 0.1 && !prev.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '';
        prev.text += space + it.str;
        prev.x1 = Math.max(prev.x1, x1);
      } else {
        cells.push({ text: it.str, x0, x1 });
      }
    }
    cells.forEach((c) => (c.text = c.text.replace(/\s+/g, ' ').trim()));
    return { y: g[0].transform[5], height, cells };
  });
}

/** Find runs of consecutive multi-cell lines and map them onto shared column ranges. */
function findTables(lines: Line[]): string[][][] {
  const result: string[][][] = [];
  let block: number[] = []; // indexes into lines
  let floor = 0; // header search must not go above the end of the previous table

  const flush = () => {
    if (block.length) {
      const table = toTable(lines, block, floor);
      if (table) {
        result.push(table);
        floor = block[block.length - 1] + 1;
      }
    }
    block = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.cells.length < MIN_COLS) {
      flush();
      continue;
    }
    const prev = lines[block[block.length - 1]];
    if (prev && prev.y - line.y > Math.max(prev.height, line.height) * 3) flush();
    block.push(i);
  }
  flush();
  return result;
}

function toTable(lines: Line[], idx: number[], floor: number): string[][] | null {
  if (idx.length < MIN_ROWS) return null;
  const block = idx.map((i) => lines[i]);

  // Projection profile: merge overlapping cell x-ranges into column ranges.
  const ranges = block
    .flatMap((l) => l.cells.map((c) => [c.x0, c.x1] as [number, number]))
    .sort((a, b) => a[0] - b[0]);
  const cols: [number, number][] = [];
  for (const r of ranges) {
    const last = cols[cols.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else cols.push([r[0], r[1]]);
  }
  if (cols.length < MIN_COLS) return null;

  // Map body lines to rows. A line with an empty first cell whose filled cells are
  // already filled in the row above is the wrapped second line of that row: merge it.
  const rows: string[][] = [];
  let lastY = 0;
  for (const line of block) {
    const row: string[] = new Array(cols.length).fill('');
    for (const c of line.cells) {
      const mid = (c.x0 + c.x1) / 2;
      const ci = cols.findIndex(([a, b]) => mid >= a && mid <= b);
      if (ci >= 0) row[ci] = row[ci] ? `${row[ci]} ${c.text}` : c.text;
    }
    const prev = rows[rows.length - 1];
    const isContinuation =
      prev &&
      row[0] === '' &&
      lastY - line.y <= line.height * 3 &&
      row.every((t, c) => t === '' || prev[c] !== '');
    if (isContinuation) row.forEach((t, c) => { if (t) prev[c] += ` ${t}`; });
    else rows.push(row);
    lastY = line.y;
  }

  if (rows.length < MIN_ROWS) return null; // re-check: wrapped lines may have been merged

  const all = rows.flat();
  const filled = all.filter(Boolean);
  const avgLen = filled.reduce((s, t) => s + t.length, 0) / (filled.length || 1);
  if (avgLen > MAX_AVG_CELL_LENGTH) return null;
  if (filled.length / all.length < 0.5) return null; // too sparse to be a table

  const header = buildHeader(lines, idx[0], floor, cols);
  return header ? [header, ...rows] : rows;
}

/**
 * Multi-line / multi-level headers: labels are often vertically staggered, so they never
 * form clean rows. Collect the tight cluster of lines right above the table and merge
 * their text per column. A label spanning several columns is repeated in each of them.
 */
function buildHeader(lines: Line[], firstIdx: number, floor: number, cols: [number, number][]): string[] | null {
  const minX = cols[0][0] - 10;
  const maxX = cols[cols.length - 1][1] + 10;
  const cluster: Line[] = [];
  let ref = lines[firstIdx].y;

  for (let j = firstIdx - 1; j >= floor; j--) {
    const l = lines[j];
    // first line may be ~3 line-heights above the body; after that lines must be tightly packed
    const limit = l.height * (cluster.length ? 1.0 : 3.5);
    if (l.y - ref > limit) break; // lines are ordered top to bottom, so l.y >= ref
    if (!l.cells.every((c) => c.x1 >= minX && c.x0 <= maxX)) break;
    cluster.push(l);
    ref = l.y;
  }
  if (cluster.length < 2) return null; // a single line above is a caption, not a header

  const header: string[][] = cols.map(() => []);
  const fragments = cluster.flatMap((l) => l.cells.map((c) => ({ ...c, y: l.y })));
  fragments.sort((a, b) => b.y - a.y || a.x0 - b.x0);
  for (const f of fragments) {
    let targets = cols.map((_, i) => i).filter((i) => f.x0 < cols[i][1] && f.x1 > cols[i][0]);
    if (!targets.length) {
      const mid = (f.x0 + f.x1) / 2;
      const dist = cols.map(([a, b]) => Math.abs(mid - (a + b) / 2));
      targets = [dist.indexOf(Math.min(...dist))];
    }
    targets.forEach((i) => header[i].push(f.text));
  }
  const row = header.map((parts) => parts.join(' '));
  return row.some(Boolean) ? row : null;
}
