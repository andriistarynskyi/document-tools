import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientError, describeError } from '../../src/app/extract-client';

describe('describeError', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['password', 'invalid', 'no-text'] as const)('keeps the specific message for %s', (code) => {
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
