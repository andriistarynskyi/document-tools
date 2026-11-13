/** Triggers a browser download of `blob` under `filename`. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a); // some browsers ignore clicks on detached anchors
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** "Quote 123.pdf" -> "Quote 123.xlsx". */
export function xlsxName(source: string): string {
  return `${source.replace(/\.pdf$/i, '') || 'tables'}.xlsx`;
}
