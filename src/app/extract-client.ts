import type { DetectionMode } from '../core/detect/find-tables';
import type { DocumentResult } from '../core/document/document';
import type { ExtractErrorCode } from '../pipeline/extract-document';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';

/** A failed extraction, carrying the worker's error code for user-facing messages. */
export class ClientError extends Error {
  constructor(readonly code: ExtractErrorCode, message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

const GENERIC_MESSAGE = 'Could not read this PDF. It may be damaged.';

/**
 * The message to show for a failed extraction. Known problems (password, damaged file, scan)
 * keep their specific message; anything unexpected is logged and gets a generic one.
 */
export function describeError(e: unknown): string {
  if (e instanceof ClientError && e.code !== 'unknown') return e.message;
  console.error(e);
  return GENERIC_MESSAGE;
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

  constructor() {
    // webpack bundles this into a separate worker chunk.
    this.worker = new Worker(new URL('../worker/extract.worker.ts', import.meta.url));
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => this.handle(e.data));
    this.worker.addEventListener('error', (e) => this.failAll(new ClientError('unknown', e.message || 'Worker failed')));
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
    return new Promise((resolve, reject) => {
      this.pending.set(req.id, { resolve, reject, onProgress });
      this.worker.postMessage(req, transfer);
    });
  }

  private handle(msg: WorkerResponse): void {
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
