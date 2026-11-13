import type { Matrix } from '../core/geometry/matrix';
import type { PageContent } from '../core/geometry/types';
import { splitRuns, type TextRun } from './char-splitter';
import { extractEdges, type OpCodes, type OperatorListLike } from './edge-extractor';

/** The slice of pdf.js `PDFPageProxy` the reader depends on (structural, so it is mockable). */
export interface PdfPageLike {
  pageNumber: number;
  getViewport(params: { scale: number }): { width: number; height: number; transform: number[] };
  getTextContent(): Promise<{ items: ReadonlyArray<unknown> }>;
  getOperatorList(): Promise<OperatorListLike>;
}

/** The slice of the pdf.js `OPS` table used by the reader. */
export interface PdfOps {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  stroke: number;
  closeStroke: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke: number;
}

export function toOpCodes(ops: PdfOps): OpCodes {
  return {
    save: ops.save,
    restore: ops.restore,
    transform: ops.transform,
    constructPath: ops.constructPath,
    formBegin: ops.paintFormXObjectBegin,
    formEnd: ops.paintFormXObjectEnd,
    paintOps: [
      ops.stroke, ops.closeStroke, ops.fill, ops.eoFill,
      ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke,
    ],
    fillOnlyOps: [ops.fill, ops.eoFill],
  };
}

function isTextRun(item: unknown): item is TextRun {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

/** Reads one page into chars and ruling edges, all in top-left-origin page coordinates. */
export async function readPage(page: PdfPageLike, ops: PdfOps): Promise<PageContent> {
  const viewport = page.getViewport({ scale: 1 });
  const matrix = viewport.transform as unknown as Matrix; // pdf.js types it as number[]
  const [text, operatorList] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
  return {
    pageNumber: page.pageNumber,
    width: viewport.width,
    height: viewport.height,
    chars: splitRuns(text.items.filter(isTextRun), matrix),
    edges: extractEdges(operatorList, toOpCodes(ops), matrix),
  };
}
