import type { DetectionMode } from '../core/detect/find-tables';
import type { DocumentResult } from '../core/document/document';
import type { ExtractErrorCode } from '../pipeline/extract-document';

/** Main thread -> worker. `analyze` re-runs detection on the last parsed file. */
export type WorkerRequest =
  | { type: 'extract'; id: number; data: ArrayBuffer; mode: DetectionMode }
  | { type: 'analyze'; id: number; mode: DetectionMode };

/** Worker -> main thread. Every message carries the id of the request it answers. */
export type WorkerResponse =
  | { type: 'progress'; id: number; fraction: number }
  | { type: 'result'; id: number; result: DocumentResult }
  | { type: 'error'; id: number; code: ExtractErrorCode; message: string };
