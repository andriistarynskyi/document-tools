export const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;

/** The parts of a `File` the checks need, so they can be tested without a browser. */
export type FileInfo = Pick<File, 'name' | 'type' | 'size'>;

/** Trusts the browser-reported MIME type; falls back to the extension when it is blank. */
export function isPdf(file: FileInfo): boolean {
  if (file.type) return file.type === 'application/pdf';
  return /\.pdf$/i.test(file.name);
}

/** A user-facing reason the file cannot be processed, or null when it is acceptable. */
export function validateFile(file: FileInfo): string | null {
  if (!isPdf(file)) return 'Only PDF files are supported. Please choose a .pdf file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_SIZE) {
    return `File is ${(file.size / BYTES_PER_MB).toFixed(1)} MB, over the ${MAX_FILE_SIZE_MB} MB limit.`;
  }
  return null;
}
