import { describe, expect, it } from 'vitest';
import { isPdf, MAX_FILE_SIZE_MB, validateFile, type FileInfo } from '../../src/app/validate-file';

const LIMIT = MAX_FILE_SIZE_MB * 1024 * 1024;
const pdf = (overrides: Partial<FileInfo> = {}): FileInfo => ({ name: 'quote.pdf', type: 'application/pdf', size: 1000, ...overrides });

describe('isPdf', () => {
  it('trusts the reported MIME type', () => {
    expect(isPdf(pdf())).toBe(true);
    expect(isPdf(pdf({ name: 'renamed.pdf', type: 'image/png' }))).toBe(false);
  });

  it('falls back to the extension when the MIME type is blank', () => {
    expect(isPdf(pdf({ type: '', name: 'Quote.PDF' }))).toBe(true);
    expect(isPdf(pdf({ type: '', name: 'quote.txt' }))).toBe(false);
  });
});

describe('validateFile', () => {
  it('accepts a normal PDF', () => {
    expect(validateFile(pdf())).toBeNull();
  });

  it('rejects other file types', () => {
    expect(validateFile(pdf({ name: 'a.xlsx', type: 'application/vnd.ms-excel' }))).toMatch(/Only PDF files/);
  });

  it('rejects empty files', () => {
    expect(validateFile(pdf({ size: 0 }))).toBe('This file is empty.');
  });

  it('accepts a file of exactly the size limit', () => {
    expect(validateFile(pdf({ size: LIMIT }))).toBeNull();
  });

  it('rejects a file one byte over the limit and states both sizes', () => {
    expect(validateFile(pdf({ size: LIMIT + 1 }))).toBe('File is 10.0 MB, over the 10 MB limit.');
  });
});
