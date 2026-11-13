import type { DetectionMode } from '../core/detect/find-tables';
import type { DocumentResult } from '../core/document/document';
import type { ExtractErrorCode } from '../pipeline/extract-document';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';
import { APP_RELOAD_MESSAGE } from './app-load-error';

/** Worker error codes, plus `load-failed` when the worker script itself could not be loaded. */
export type ClientErrorCode = ExtractErrorCode | 'load-failed';

/** A failed extraction, carrying the worker's error code for user-facing messages. */
export class ClientError extends Error {
  constructor(readonly code: ClientErrorCode, message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

const GENERIC_MESSAGE = 'Could not read this PDF. It may be damaged.';

/**
 * The message to show for a failed extraction. Known problems (password, damaged file, scan,
 * an app part that failed to load) keep their specific message; anything unexpected is
 * logged and gets a generic one.
 */
export function describeError(e: unknown): string {
  if (e instanceof ClientError && e.code !== 'unknown') return e.message;
  console.error(e);
  return GENERIC_MESSAGE;
}

/**
 * The message of a worker error event. Read structurally rather than with `instanceof
 * ErrorEvent`: that global is missing in some runtimes (e.g. Node 24, where tests run).
 */
function errorDetail(e: Event): string {
  const message: unknown = Reflect.get(e, 'message');
  return typeof message === 'string' && message ? message : 'Worker failed';
}

interface Pending {
  resolve(result: DocumentResult): void;
  reject(error: Error): void;
  onProgress?: (fraction: number) => void;
}

/** Promise wrapper around the extraction worker. */
export class ExtractClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  /** Set once the worker has sent anything, i.e. its script (and pdf.js) loaded. */
  private hasStarted = false;
  /** Set when the worker could not load; it is dead, so later requests fail at once. */
  private loadFailure: ClientError | null = null;

  constructor() {
    // webpack bundles this into a separate worker chunk.
    this.worker = new Worker(new URL('../worker/extract.worker.ts', import.meta.url));
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => this.handle(e.data));
    this.worker.addEventListener('error', (e) => this.handleError(e));
  }

  /** Parses and analyses a PDF. The buffer is transferred to the worker (unusable afterwards). */
  extract(data: ArrayBuffer, mode: DetectionMode, onProgress?: (f: number) => void): Promise<DocumentResult> {
    return this.send({ type: 'extract', id: this.nextId++, data, mode }, onProgress, [data]);
  }

  /** Re-runs detection on the last extracted file with another mode. */
  analyze(mode: DetectionMode): Promise<DocumentResult> {
    return this.send({ type: 'analyze', id: this.nextId++, mode });
  }

  private send(req: WorkerRequest, onProgress?: (f: number) => void, transfer: Transferable[] = []): Promise<DocumentResult> {
    // A worker that failed to load never answers; without this the request would hang forever.
    if (this.loadFailure) return Promise.reject(this.loadFailure);
    return new Promise((resolve, reject) => {
      this.pending.set(req.id, { resolve, reject, onProgress });
      this.worker.postMessage(req, transfer);
    });
  }

  /**
   * An error before the worker ever answered means its script, or the pdf.js chunk it pulls
   * in, failed to load. Later errors are failures inside a running worker.
   */
  private handleError(e: Event): void {
    if (!this.hasStarted) {
      this.loadFailure = new ClientError('load-failed', APP_RELOAD_MESSAGE);
      this.failAll(this.loadFailure);
      return;
    }
    this.failAll(new ClientError('unknown', errorDetail(e)));
  }

  private handle(msg: WorkerResponse): void {
    this.hasStarted = true;
    const entry = this.pending.get(msg.id);
    if (!entry) return; // a stale answer to a request nobody waits for any more
    if (msg.type === 'progress') {
      entry.onProgress?.(msg.fraction);
      return;
    }
    this.pending.delete(msg.id);
    if (msg.type === 'result') entry.resolve(msg.result);
    else entry.reject(new ClientError(msg.code, msg.message));
  }

  private failAll(error: Error): void {
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
  }
}
