import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readPage, type PdfOps, type PdfPageLike } from '../../src/reader/page-reader';
import type { PageContent } from '../../src/core/geometry/types';

export const PAGE_HEIGHT = 792;

/** Drawing context for one fixture page. Coordinates use TOP-left origin like the core. */
export interface Canvas {
  page: PDFPage;
  font: PDFFont;
  line(x0: number, top0: number, x1: number, top1: number, width?: number): void;
  rect(x: number, top: number, w: number, h: number): void;
  /** Filled rectangle without a border (shading, or a thin filled line). 0 = black, 1 = white. */
  fill(x: number, top: number, w: number, h: number, gray?: number): void;
  text(str: string, x: number, top: number, size?: number): void;
}

function canvas(page: PDFPage, font: PDFFont): Canvas {
  const black = rgb(0, 0, 0);
  return {
    page,
    font,
    line: (x0, t0, x1, t1, width = 0.75) =>
      page.drawLine({
        start: { x: x0, y: PAGE_HEIGHT - t0 },
        end: { x: x1, y: PAGE_HEIGHT - t1 },
        thickness: width,
        color: black,
      }),
    rect: (x, top, w, h) =>
      page.drawRectangle({
        x, y: PAGE_HEIGHT - top - h, width: w, height: h, borderColor: black, borderWidth: 0.75,
      }),
    fill: (x, top, w, h, gray = 0) =>
      page.drawRectangle({ x, y: PAGE_HEIGHT - top - h, width: w, height: h, color: rgb(gray, gray, gray) }),
    text: (str, x, top, size = 10) =>
      page.drawText(str, { x, y: PAGE_HEIGHT - top - size, size, font, color: black }),
  };
}

/** Builds a one-page-per-callback PDF in memory and returns its bytes. */
export async function makePdf(pages: Array<(c: Canvas) => void>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const draw of pages) draw(canvas(doc.addPage([612, PAGE_HEIGHT]), font));
  return doc.save();
}

/** Parses PDF bytes with pdf.js and reads every page into PageContent. */
export async function readAllPages(bytes: Uint8Array): Promise<PageContent[]> {
  const doc = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;
  const out: PageContent[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    out.push(await readPage(page as unknown as PdfPageLike, pdfjs.OPS as unknown as PdfOps)); // structural subset of pdf.js types
  }
  return out;
}

/** Draws a full grid of lines and fills cell text. `rows[r][c]` is placed in row r, column c. */
export function drawLinedTable(c: Canvas, xs: number[], ys: number[], rows: string[][]): void {
  for (const y of ys) c.line(xs[0], y, xs[xs.length - 1], y);
  for (const x of xs) c.line(x, ys[0], x, ys[ys.length - 1]);
  rows.forEach((row, r) => row.forEach((t, k) => t && c.text(t, xs[k] + 4, ys[r] + 5)));
}
