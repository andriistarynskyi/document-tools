// Legacy build: broad browser support (incl. older mobile Safari/Chrome).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// ---------------------------------------------------------------------------
// Worker setup — fall back to main-thread if the worker file is unreachable.
// ---------------------------------------------------------------------------
const WORKER_SRC = new URL('pdf.worker.min.mjs', document.baseURI).href;
pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
let workerVerified = false;

async function ensureWorker(): Promise<void> {
  if (workerVerified) return;
  try {
    const res = await fetch(WORKER_SRC, { method: 'HEAD' });
    if (res.ok) { workerVerified = true; return; }
  } catch { /* fall through */ }
  console.warn('[pdf-tables] Worker unreachable — running in main-thread mode.');
  pdfjs.GlobalWorkerOptions.workerSrc = '';
  workerVerified = true;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DetectedTable {
  id: number;
  page: number;
  rows: string[][];
}

export interface ExtractResult {
  tables: DetectedTable[];
  pages: number;
}

export type ProgressCallback = (fraction: number) => void;

export function isPasswordError(e: unknown): boolean {
  return e instanceof Error && e.name === 'PasswordException';
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Fragment {
  text: string;
  x0: number;
  x1: number;
  y: number;
  h: number;
}

interface Line {
  y: number;
  h: number;
  frags: Fragment[];
}

interface Column {
  center: number;
  label: string;
  lo: number; // Voronoi left boundary
  hi: number; // Voronoi right boundary
}

interface RawTable {
  startPage: number;
  endPage: number;
  rows: string[][];
  colCenters: number[];
  headerRow: string[];
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const MAX_PAGES = 1000;
const MAX_ITEMS_PER_PAGE = 50_000;

/**
 * Minimum number of columns a header must produce to be considered a real
 * table header (not a 2-column key:value metadata block).
 */
const MIN_HEADER_COLS = 3;

/**
 * A valid table header must span at least this fraction of the page width.
 * Standard A4/Letter pages are ~595 pts wide; 30% = ~178 pts.
 */
const MIN_HEADER_SPAN_RATIO = 0.30;

/**
 * Estimated page width (pts). Used to compute header span ratio.
 * Most business PDFs are US Letter (612) or A4 (595).
 */
const ESTIMATED_PAGE_WIDTH = 600;

/**
 * When scanning below a candidate header for a qualifying data row,
 * look ahead this many lines (skipping blank/annotation lines).
 */
const LOOKAHEAD_LINES = 6;

/** Two columns whose centers are within this many pts are merged into one. */
const COL_MERGE_DISTANCE = 8;

/**
 * A data row must have at least this fraction of its fragments assigned to
 * defined columns to count as a table row.
 */
const ROW_COVERAGE_THRESHOLD = 0.4;

/** Max vertical gap (× line height) between consecutive body rows. */
const MAX_ROW_GAP_FACTOR = 12;

/** Fraction of column centers that must match for cross-page merge. */
const CROSS_PAGE_COL_SIMILARITY = 0.55;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const yieldToUI = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export async function extractTables(
  data: ArrayBuffer,
  onProgress?: ProgressCallback,
): Promise<ExtractResult> {
  await ensureWorker();
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    const rawTables: RawTable[] = [];

    for (let p = 1; p <= pageCount; p++) {
      const page = await doc.getPage(p);
      try {
        const content = await page.getTextContent();
        const frags = toFragments(content.items as TextItem[]);
        console.debug(`[pdf-tables] p${p}: ${frags.length} fragments`);
        if (frags.length <= MAX_ITEMS_PER_PAGE) {
          const lines = toLines(frags);
          const tables = detectTables(lines);
          console.debug(`[pdf-tables] p${p}: ${tables.length} raw tables`);
          for (const t of tables) rawTables.push({ ...t, startPage: p, endPage: p });
        }
      } finally {
        page.cleanup();
      }
      onProgress?.(p / pageCount);
      await yieldToUI();
    }

    const merged = mergeAcrossPages(rawTables);
    console.debug(`[pdf-tables] total after merge: ${merged.length}`);

    return {
      tables: merged.map((rt, i) => ({ id: i + 1, page: rt.startPage, rows: rt.rows })),
      pages: doc.numPages,
    };
  } finally {
    await task.destroy();
  }
}

// ---------------------------------------------------------------------------
// Step 1: raw fragments
// ---------------------------------------------------------------------------

function toFragments(items: TextItem[]): Fragment[] {
  return items
    .filter((i): i is TextItem => 'str' in i && i.str.trim().length > 0)
    .map(i => ({
      text: i.str,
      x0: i.transform[4],
      x1: i.transform[4] + i.width,
      y: i.transform[5],
      h: i.height || 10,
    }));
}

// ---------------------------------------------------------------------------
// Step 2: group fragments into visual lines
// ---------------------------------------------------------------------------

function toLines(frags: Fragment[]): Line[] {
  const sorted = [...frags].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const groups: Fragment[][] = [];
  for (const f of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].y - f.y) <= f.h * 0.4) {
      last.push(f);
    } else {
      groups.push([f]);
    }
  }
  return groups.map(g => {
    g.sort((a, b) => a.x0 - b.x0);
    return { y: g[0].y, h: Math.max(...g.map(f => f.h)), frags: g };
  });
}

// ---------------------------------------------------------------------------
// Step 3: detect tables — header-anchored approach
// ---------------------------------------------------------------------------

function detectTables(lines: Line[]): Omit<RawTable, 'startPage' | 'endPage'>[] {
  const result: Omit<RawTable, 'startPage' | 'endPage'>[] = [];
  let i = 0;

  while (i < lines.length) {
    const header = tryBuildHeader(lines, i);
    if (!header) { i++; continue; }

    const { cols, headerLines, headerRow } = header;
    const dataStart = i + headerLines;
    const bodyRows = collectBody(lines, dataStart, cols);

    if (bodyRows.length >= 1) {
      result.push({
        rows: [headerRow, ...bodyRows],
        colCenters: cols.map(c => c.center),
        headerRow,
      });
    }

    i = dataStart + Math.max(bodyRows.length, 1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

interface HeaderResult {
  cols: Column[];
  headerLines: number;
  headerRow: string[];
}

/**
 * Try to find a table header starting at lines[startIdx].
 *
 * A valid table header must:
 *   1. Be 1–3 consecutive text-dominant lines
 *   2. Produce ≥ MIN_HEADER_COLS distinct columns
 *   3. Span ≥ MIN_HEADER_SPAN_RATIO of page width
 *   4. Have at least one data-like row within LOOKAHEAD_LINES below it
 */
function tryBuildHeader(lines: Line[], startIdx: number): HeaderResult | null {
  for (let depth = 1; depth <= 3; depth++) {
    if (startIdx + depth > lines.length) break;
    const cluster = lines.slice(startIdx, startIdx + depth);

    if (!cluster.every(l => isHeaderLine(l))) continue;

    const cols = buildColumns(cluster);
    if (cols.length < MIN_HEADER_COLS) continue;

    // Must span a significant fraction of page width.
    const spanWidth = cols[cols.length - 1].center - cols[0].center;
    if (spanWidth < ESTIMATED_PAGE_WIDTH * MIN_HEADER_SPAN_RATIO) continue;

    // Look ahead for at least one data row that maps well to these columns.
    const dataStart = startIdx + depth;
    let foundDataRow = false;
    for (let scan = dataStart; scan < Math.min(dataStart + LOOKAHEAD_LINES, lines.length); scan++) {
      if (hasDataCoverage(lines[scan], cols)) {
        foundDataRow = true;
        break;
      }
    }
    if (!foundDataRow) continue;

    const headerRow = cols.map(c => c.label);
    return { cols, headerLines: depth, headerRow };
  }
  return null;
}

/**
 * A line qualifies as a header line when:
 * - It contains at least 2 fragments (a single-word line is probably a title)
 * - The majority of tokens are NOT pure decimal numbers or date strings
 *   (short words, abbreviations, and codes like QTY/UOM/NET are all fine)
 */
function isHeaderLine(line: Line): boolean {
  if (line.frags.length < 2) return false;
  const tokens = line.frags.map(f => f.text.trim()).filter(Boolean);
  // Only reject tokens that are pure decimal numbers or date-formatted strings.
  const pureNumericRe = /^-?[\d,]+(\.\d+)?$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  const numericCount = tokens.filter(t => pureNumericRe.test(t)).length;
  return numericCount / tokens.length < 0.5;
}

/**
 * A line has "data coverage" when enough of its fragments align with the
 * column layout AND at least one fragment looks like actual data
 * (a number, date, code, or short value — not all prose text).
 */
function hasDataCoverage(line: Line, cols: Column[]): boolean {
  if (line.frags.length === 0) return false;
  const coverage = lineCoverage(line, cols);
  if (coverage < ROW_COVERAGE_THRESHOLD) return false;

  // Require at least one token to look like data (number, date, short code/id).
  const dataRe = /^-?[\d,]+(\.\d+)?$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^[A-Z0-9\-\/]{1,20}$|^\/\//;
  return line.frags.some(f => dataRe.test(f.text.trim()));
}

// ---------------------------------------------------------------------------
// Column building from header cluster
// ---------------------------------------------------------------------------

/**
 * Build Column definitions from a 1–3 line header cluster.
 *
 * 1. Within each line, merge adjacent fragments that are close together
 *    (gap ≤ 1.5× font height) into single compound anchors.
 * 2. Group anchors across lines using x-range overlap (union-find).
 * 3. Compute center = weighted mean of fragment centers per group.
 * 4. Sort by center, merge pairs that are very close.
 * 5. Assign Voronoi boundaries (midpoints between adjacent centers).
 */
function buildColumns(cluster: Line[]): Column[] {
  interface Anchor { x0: number; x1: number; cx: number; text: string; lineY: number; }
  const anchors: Anchor[] = [];

  for (const line of cluster) {
    let cur: Anchor | null = null;
    for (const f of line.frags) {
      // Merge with current anchor if gap is small relative to font height.
      if (cur && f.x0 - cur.x1 <= line.h * 1.5) {
        cur.text += ' ' + f.text;
        cur.x1 = Math.max(cur.x1, f.x1);
        cur.cx = (cur.x0 + cur.x1) / 2;
      } else {
        if (cur) anchors.push(cur);
        cur = { x0: f.x0, x1: f.x1, cx: (f.x0 + f.x1) / 2, text: f.text, lineY: line.y };
      }
    }
    if (cur) anchors.push(cur);
  }

  if (anchors.length === 0) return [];

  // Sort by x0 for the union-find sweep.
  anchors.sort((a, b) => a.x0 - b.x0);

  // Union-find: group anchors from different lines that share x-range overlap.
  const parent = anchors.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(i: number, j: number): void { parent[find(i)] = find(j); }

  for (let a = 0; a < anchors.length; a++) {
    for (let b = a + 1; b < anchors.length; b++) {
      if (anchors[b].x0 > anchors[a].x1 + 40) break; // no more overlaps possible
      // Overlap: x-ranges intersect.
      if (anchors[a].x1 > anchors[b].x0 && anchors[b].x1 > anchors[a].x0) {
        union(a, b);
      }
    }
  }

  // Build one raw Column per union group.
  const groups = new Map<number, Anchor[]>();
  for (let a = 0; a < anchors.length; a++) {
    const root = find(a);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(anchors[a]);
  }

  const rawCols: Column[] = [];
  for (const group of groups.values()) {
    const cx = group.reduce((s, a) => s + a.cx, 0) / group.length;
    // Labels: top-to-bottom (higher y = higher on page in PDF coords).
    const byLine = [...group].sort((a, b) => b.lineY - a.lineY);
    const label = byLine.map(a => a.text.trim()).filter(Boolean).join(' ');
    rawCols.push({ center: cx, label, lo: 0, hi: 0 });
  }

  rawCols.sort((a, b) => a.center - b.center);

  // Merge columns whose centers are very close.
  const merged: Column[] = [{ ...rawCols[0] }];
  for (let i = 1; i < rawCols.length; i++) {
    const prev = merged[merged.length - 1];
    if (rawCols[i].center - prev.center < COL_MERGE_DISTANCE) {
      prev.center = (prev.center + rawCols[i].center) / 2;
      prev.label = (prev.label + ' ' + rawCols[i].label).trim();
    } else {
      merged.push({ ...rawCols[i] });
    }
  }

  assignVoronoi(merged);
  return merged;
}

function assignVoronoi(cols: Column[]): void {
  for (let i = 0; i < cols.length; i++) {
    cols[i].lo = i === 0 ? -Infinity : (cols[i - 1].center + cols[i].center) / 2;
    cols[i].hi = i === cols.length - 1 ? Infinity : (cols[i].center + cols[i + 1].center) / 2;
  }
}

// ---------------------------------------------------------------------------
// Coverage and row mapping
// ---------------------------------------------------------------------------

/**
 * Fraction of a line's fragments (within the table x-span) that fall inside
 * a defined column's Voronoi cell. Since Voronoi covers the entire number line,
 * every fragment is always in some column — so we instead measure what fraction
 * of fragments are within the physical extent of the table (leftmost col center
 * − half gap to rightmost col center + half gap).
 */
function lineCoverage(line: Line, cols: Column[]): number {
  if (line.frags.length === 0) return 0;

  // Table x-span: from slightly left of first col to slightly right of last col.
  const halfGapLeft = cols.length > 1 ? (cols[1].center - cols[0].center) / 2 : 50;
  const halfGapRight = cols.length > 1
    ? (cols[cols.length - 1].center - cols[cols.length - 2].center) / 2
    : 50;
  const tableX0 = cols[0].center - halfGapLeft;
  const tableX1 = cols[cols.length - 1].center + halfGapRight;

  const inSpan = line.frags.filter(f => {
    const cx = (f.x0 + f.x1) / 2;
    return cx >= tableX0 - 10 && cx <= tableX1 + 10;
  });
  return inSpan.length / line.frags.length;
}

/**
 * Map every fragment in a line to its column using Voronoi assignment
 * (nearest column center). Multiple fragments in the same column are
 * space-joined in left-to-right order.
 */
function mapToRow(line: Line, cols: Column[]): string[] {
  const row: string[] = new Array(cols.length).fill('');

  // Compute table x-span to decide if a fragment is in-scope.
  const halfGapLeft = cols.length > 1 ? (cols[1].center - cols[0].center) / 2 : 50;
  const halfGapRight = cols.length > 1
    ? (cols[cols.length - 1].center - cols[cols.length - 2].center) / 2
    : 50;
  const tableX0 = cols[0].center - halfGapLeft - 10;
  const tableX1 = cols[cols.length - 1].center + halfGapRight + 10;

  for (const f of line.frags) {
    const cx = (f.x0 + f.x1) / 2;
    if (cx < tableX0 || cx > tableX1) continue; // outside table span

    // Assign to nearest column center (Voronoi).
    let ci = 0;
    let minDist = Math.abs(cx - cols[0].center);
    for (let j = 1; j < cols.length; j++) {
      const d = Math.abs(cx - cols[j].center);
      if (d < minDist) { minDist = d; ci = j; }
    }
    row[ci] = row[ci] ? row[ci] + ' ' + f.text : f.text;
  }

  return row;
}

// ---------------------------------------------------------------------------
// Body collection
// ---------------------------------------------------------------------------

function collectBody(lines: Line[], startIdx: number, cols: Column[]): string[][] {
  const rows: string[][] = [];
  let lastY: number | null = null;
  let lastH = 9;
  // Track consecutive low-coverage lines to detect end of table.
  let skipStreak = 0;
  const MAX_SKIP = 8; // allow up to 8 annotation/description lines in a row

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Gap check against last processed line.
    if (lastY !== null && lastY - line.y > lastH * MAX_ROW_GAP_FACTOR) break;

    const coverage = lineCoverage(line, cols);

    if (coverage < ROW_COVERAGE_THRESHOLD) {
      skipStreak++;
      if (skipStreak > MAX_SKIP) break;

      // Description/annotation line inside the table span — append to last row's
      // widest (description) column.
      if (rows.length > 0 && isWithinTableSpan(line, cols)) {
        const descText = line.frags.map(f => f.text).join(' ').trim();
        // Find the widest column (largest Voronoi gap) — most likely the description column.
        const widestCol = cols.reduce((best, c, idx) => {
          const w = (c.hi === Infinity ? c.center + 100 : c.hi) -
                    (c.lo === -Infinity ? c.center - 100 : c.lo);
          const bw = (cols[best].hi === Infinity ? cols[best].center + 100 : cols[best].hi) -
                     (cols[best].lo === -Infinity ? cols[best].center - 100 : cols[best].lo);
          return w > bw ? idx : best;
        }, 0);
        // But prefer the column whose center is nearest to the text's x midpoint.
        const textCx = line.frags.length > 0
          ? (line.frags[0].x0 + line.frags[line.frags.length - 1].x1) / 2
          : cols[widestCol].center;
        let ci = widestCol;
        // Only override to nearest if the text is clearly aligned to a different column.
        let minDist = Math.abs(textCx - cols[widestCol].center);
        for (let j = 0; j < cols.length; j++) {
          const d = Math.abs(textCx - cols[j].center);
          if (d < minDist - 20) { minDist = d; ci = j; }
        }
        const last = rows[rows.length - 1];
        last[ci] = last[ci] ? last[ci] + ' ' + descText : descText;
      }
      lastY = line.y;
      lastH = line.h;
      continue;
    }

    skipStreak = 0;
    rows.push(mapToRow(line, cols));
    lastY = line.y;
    lastH = line.h;
  }

  return rows;
}

function isWithinTableSpan(line: Line, cols: Column[]): boolean {
  if (line.frags.length === 0) return false;
  const halfGapLeft = cols.length > 1 ? (cols[1].center - cols[0].center) / 2 : 50;
  const halfGapRight = cols.length > 1
    ? (cols[cols.length - 1].center - cols[cols.length - 2].center) / 2
    : 50;
  const tableX0 = cols[0].center - halfGapLeft;
  const tableX1 = cols[cols.length - 1].center + halfGapRight;
  const lineX0 = line.frags[0].x0;
  const lineX1 = line.frags[line.frags.length - 1].x1;
  return lineX0 >= tableX0 - 30 && lineX1 <= tableX1 + 30;
}

// ---------------------------------------------------------------------------
// Cross-page merging
// ---------------------------------------------------------------------------

function mergeAcrossPages(tables: RawTable[]): RawTable[] {
  if (tables.length < 2) return tables;

  const byPage = new Map<number, RawTable[]>();
  for (const t of tables) {
    if (!byPage.has(t.startPage)) byPage.set(t.startPage, []);
    byPage.get(t.startPage)!.push(t);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  const maxPerPage = Math.max(...[...byPage.values()].map(v => v.length));

  const result: RawTable[] = [];

  for (let slot = 0; slot < maxPerPage; slot++) {
    const chain: RawTable[] = [];
    for (const p of pages) {
      const pt = byPage.get(p) ?? [];
      if (slot < pt.length) chain.push(pt[slot]);
    }
    if (!chain.length) continue;

    const merged: RawTable[] = [{ ...chain[0], rows: [...chain[0].rows] }];

    for (let i = 1; i < chain.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = chain[i];

      if (curr.startPage !== prev.endPage + 1) {
        merged.push({ ...curr, rows: [...curr.rows] });
        continue;
      }

      const sim = colCenterSimilarity(prev.colCenters, curr.colCenters);
      console.debug(`[pdf-tables] slot${slot} p${prev.endPage}→${curr.startPage} sim=${sim.toFixed(2)}`);

      if (sim < CROSS_PAGE_COL_SIMILARITY) {
        merged.push({ ...curr, rows: [...curr.rows] });
        continue;
      }

      // Drop repeated header rows.
      let contRows = curr.rows;
      for (let drop = 0; drop < 3 && contRows.length > 0 && rowsMatch(contRows[0], prev.headerRow); drop++) {
        contRows = contRows.slice(1);
      }

      if (!contRows.length) continue;
      // Skip if all rows are already present.
      if (contRows.every(r => prev.rows.some(pr => rowsMatch(r, pr)))) continue;

      prev.rows = [...prev.rows, ...contRows];
      prev.endPage = curr.endPage;
    }

    result.push(...merged);
  }

  result.sort((a, b) => a.startPage - b.startPage);
  return result;
}

function colCenterSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  let matches = 0;
  for (const ca of a) {
    if (b.some(cb => Math.abs(ca - cb) < 25)) matches++;
  }
  return matches / Math.max(a.length, b.length);
}

function rowsMatch(a: string[], b: string[]): boolean {
  const len = Math.max(a.length, b.length);
  if (len === 0) return false;
  const filled = a.filter(Boolean).length;
  if (filled === 0) return false;
  const matching = a.filter((v, i) => v && v === b[i]).length;
  return matching / len >= 0.55;
}
