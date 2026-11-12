/**
 * Shared geometry types for the table extraction core.
 *
 * Coordinates follow pdfplumber's convention: the origin is the TOP-LEFT of the page,
 * y grows downward (`top` < `bottom`). The pdf.js reader converts into this system
 * so every algorithm below can be a direct port of its pdfplumber counterpart.
 *
 * This module is pure data: no DOM and no pdf.js imports.
 */

export interface BBox {
  x0: number;
  top: number;
  x1: number;
  bottom: number;
}

export interface Char extends BBox {
  text: string;
  /** Font size in points. */
  size: number;
  /** True when the char is drawn upright (not rotated). */
  upright: boolean;
}

export interface Word extends BBox {
  text: string;
  upright: boolean;
}

/** A line segment (horizontal or vertical) used as a table edge. */
export interface Edge extends BBox {
  orientation: 'h' | 'v';
  width: number;
  height: number;
}

export interface PageContent {
  pageNumber: number;
  width: number;
  height: number;
  chars: Char[];
  /** Ruling lines extracted from vector graphics (strokes and thin rectangles). */
  edges: Edge[];
}
