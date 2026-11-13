import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_RELOAD_MESSAGE } from '../../src/app/app-load-error';
import { ClientError, describeError, ExtractClient } from '../../src/app/extract-client';
import type { WorkerRequest, WorkerResponse } from '../../src/worker/protocol';

/** Stands in for the browser Worker: records requests, lets tests send answers and errors. */
class FakeWorker extends EventTarget {
  static last: FakeWorker;
  readonly sent: WorkerRequest[] = [];
  constructor() {
    super();
    FakeWorker.last = this;
  }
  postMessage(msg: WorkerRequest): void {
    this.sent.push(msg);
  }
  answer(msg: WorkerResponse): void {
    this.dispatchEvent(Object.assign(new Event('message'), { data: msg }));
  }
  fail(): void {
    this.dispatchEvent(new Event('error'));
  }
}

const RESULT = { pageCount: 1, header: [], footer: [], tables: [] };

describe('describeError', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['password', 'invalid', 'no-text', 'load-failed'] as const)('keeps the specific message for %s', (code) => {
    expect(describeError(new ClientError(code, `specific ${code}`))).toBe(`specific ${code}`);
  });

  it('logs unexpected errors and returns a generic message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');
    expect(describeError(error)).toBe('Could not read this PDF. It may be damaged.');
    expect(log).toHaveBeenCalledWith(error);
  });

  it('treats unknown worker errors as unexpected', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(describeError(new ClientError('unknown', 'internal detail'))).toBe('Could not read this PDF. It may be damaged.');
  });
});

describe('ExtractClient', () => {
  beforeEach(() => vi.stubGlobal('Worker', FakeWorker));
  afterEach(() => vi.unstubAllGlobals());

  it('resolves with the result and reports progress', async () => {
    const client = new ExtractClient();
    const progress: number[] = [];
    const pending = client.extract(new ArrayBuffer(8), 'auto', (f) => progress.push(f));
    const { id } = FakeWorker.last.sent[0];
    FakeWorker.last.answer({ type: 'progress', id, fraction: 0.5 });
    FakeWorker.last.answer({ type: 'result', id, result: RESULT });
    await expect(pending).resolves.toEqual(RESULT);
    expect(progress).toEqual([0.5]);
  });

  it('reports a worker that never started as a load failure with the reload message', async () => {
    const client = new ExtractClient();
    const pending = client.extract(new ArrayBuffer(8), 'auto');
    FakeWorker.last.fail();
    await expect(pending).rejects.toMatchObject({ code: 'load-failed', message: APP_RELOAD_MESSAGE });
  });

  it('fails later requests at once instead of waiting forever on a dead worker', async () => {
    const client = new ExtractClient();
    const first = client.extract(new ArrayBuffer(8), 'auto');
    FakeWorker.last.fail();
    await expect(first).rejects.toBeInstanceOf(ClientError);
    await expect(client.analyze('stream')).rejects.toMatchObject({ code: 'load-failed' });
    expect(FakeWorker.last.sent).toHaveLength(1);
  });

  it('treats an error after the worker answered as a failure inside the worker', async () => {
    // Some runtimes (Node 24) have no global ErrorEvent; the client must not depend on it.
    vi.stubGlobal('ErrorEvent', undefined);
    const client = new ExtractClient();
    const first = client.extract(new ArrayBuffer(8), 'auto');
    FakeWorker.last.answer({ type: 'result', id: FakeWorker.last.sent[0].id, result: RESULT });
    await first;
    const second = client.analyze('lattice');
    FakeWorker.last.fail();
    await expect(second).rejects.toMatchObject({ code: 'unknown' });
  });
});
