import { applyToPoint, IDENTITY, multiply, type Matrix } from '../core/geometry/matrix';
import type { Edge } from '../core/geometry/types';

/** The pdf.js operator list shape (fnArray[i] is the opcode, argsArray[i] its arguments). */
export interface OperatorListLike {
  fnArray: ArrayLike<number>;
  argsArray: ArrayLike<unknown>;
}

/** Opcode numbers from pdf.js `OPS`, injected so this module never imports pdf.js. */
export interface OpCodes {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
  formBegin: number;
  formEnd: number;
  /** Opcodes that actually paint (stroke / fill variants). `endPath` (clip) is excluded. */
  paintOps: readonly number[];
}

// pdf.js path-segment codes inside a constructPath payload.
const MOVE_TO = 0;
const LINE_TO = 1;
const CURVE_TO = 2;
const QUAD_TO = 3;
const CLOSE = 4;

/** Max deviation (pts) for a segment to still count as horizontal / vertical. */
const AXIS_TOLERANCE = 0.1;

type Point = readonly [number, number];

interface SubPath {
  points: Point[];
  closed: boolean;
  isCurved: boolean;
}

function parsePath(coords: ArrayLike<number>): SubPath[] {
  const paths: SubPath[] = [];
  const current = (x: number, y: number): SubPath => {
    if (paths.length === 0) paths.push({ points: [[x, y]], closed: false, isCurved: false });
    return paths[paths.length - 1];
  };
  let i = 0;
  while (i < coords.length) {
    const code = coords[i++];
    if (code === MOVE_TO) {
      paths.push({ points: [[coords[i], coords[i + 1]]], closed: false, isCurved: false });
      i += 2;
    } else if (code === LINE_TO) {
      current(coords[i], coords[i + 1]).points.push([coords[i], coords[i + 1]]);
      i += 2;
    } else if (code === CURVE_TO || code === QUAD_TO) {
      const n = code === CURVE_TO ? 6 : 4;
      const p = current(coords[i + n - 2], coords[i + n - 1]);
      p.isCurved = true;
      p.points.push([coords[i + n - 2], coords[i + n - 1]]);
      i += n;
    } else if (code === CLOSE) {
      if (paths.length > 0) paths[paths.length - 1].closed = true;
    } else {
      break; // unknown code: stop rather than misread the rest as coordinates
    }
  }
  return paths;
}

function toEdge(p: Point, q: Point): Edge | null {
  const dx = Math.abs(q[0] - p[0]);
  const dy = Math.abs(q[1] - p[1]);
  if (dy <= AXIS_TOLERANCE && dx > AXIS_TOLERANCE) {
    const y = (p[1] + q[1]) / 2;
    const x0 = Math.min(p[0], q[0]);
    const x1 = Math.max(p[0], q[0]);
    return { orientation: 'h', x0, x1, top: y, bottom: y, width: x1 - x0, height: 0 };
  }
  if (dx <= AXIS_TOLERANCE && dy > AXIS_TOLERANCE) {
    const x = (p[0] + q[0]) / 2;
    const top = Math.min(p[1], q[1]);
    const bottom = Math.max(p[1], q[1]);
    return { orientation: 'v', x0: x, x1: x, top, bottom, width: 0, height: bottom - top };
  }
  return null;
}

function subPathEdges(path: SubPath, m: Matrix): Edge[] {
  if (path.isCurved) return [];
  const pts = path.points.map(([x, y]) => applyToPoint(m, x, y) as Point);
  if (path.closed && pts.length > 1) pts.push(pts[0]);
  const edges: Edge[] = [];
  for (let i = 1; i < pts.length; i++) {
    const edge = toEdge(pts[i - 1], pts[i]);
    if (edge) edges.push(edge);
  }
  return edges;
}

function asMatrix(args: unknown): Matrix | null {
  if (!args || typeof args !== 'object' || !('length' in args)) return null;
  const a = args as ArrayLike<number>;
  return a.length >= 6 ? [a[0], a[1], a[2], a[3], a[4], a[5]] : null;
}

function pathPayload(args: unknown): { paintOp: number; coords: ArrayLike<number> } | null {
  if (!Array.isArray(args) || !Array.isArray(args[1]) || !args[1][0]) return null;
  return { paintOp: args[0] as number, coords: args[1][0] as ArrayLike<number> };
}

/**
 * Walks a pdf.js operator list, tracking the current transformation matrix, and returns
 * every horizontal / vertical segment that was stroked or filled, in page coordinates.
 * Rectangles contribute their four sides, matching pdfplumber's `rect_to_edges`.
 */
export function extractEdges(ops: OperatorListLike, codes: OpCodes, viewport: Matrix): Edge[] {
  const paint = new Set(codes.paintOps);
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  const edges: Edge[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === codes.save) {
      stack.push(ctm);
    } else if (fn === codes.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === codes.transform) {
      const m = asMatrix(args);
      if (m) ctm = multiply(m, ctm);
    } else if (fn === codes.formBegin) {
      stack.push(ctm);
      const m = asMatrix(Array.isArray(args) ? args[0] : null);
      if (m) ctm = multiply(m, ctm);
    } else if (fn === codes.formEnd) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === codes.constructPath) {
      const payload = pathPayload(args);
      if (!payload || !paint.has(payload.paintOp)) continue;
      const total = multiply(ctm, viewport);
      for (const sub of parsePath(payload.coords)) edges.push(...subPathEdges(sub, total));
    }
  }
  return edges;
}
