/** A spreadsheet-ready cell: text, or a number with the display format that keeps its look. */
export type CellValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; value: number; format: string };

// Characters that make a spreadsheet cell a live formula. PDF text is untrusted, so any cell
// starting with one of these is neutralised to prevent formula injection.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/** 1234, 1,234, 1,234.50, -12.5 and (1,234) for negatives. Leading zeros stay text (ids, codes). */
const NUMBER = /^(-)?(\()?((?:[1-9]\d{0,2}(?:,\d{3})+)|(?:[1-9]\d*)|0)(\.\d+)?(\))?$/;
/** Longer digit runs lose precision as doubles (and are usually ids). */
const MAX_DIGITS = 15;

function sanitize(text: string): string {
  return FORMULA_TRIGGERS.test(text) ? `'${text}` : text;
}

function numberFormat(hasGrouping: boolean, decimals: number, isParenNegative: boolean): string {
  const int = hasGrouping ? '#,##0' : '0';
  const base = decimals > 0 ? `${int}.${'0'.repeat(decimals)}` : int;
  return isParenNegative ? `${base};(${base})` : base;
}

/** Parses a cell's text as a number when it is unambiguously one; null otherwise. */
export function parseNumber(text: string): { value: number; format: string } | null {
  const m = NUMBER.exec(text.trim());
  if (!m) return null;
  const [, minus, open, intPart, fraction = '', close] = m;
  if (Boolean(open) !== Boolean(close) || (minus && open)) return null;
  const digits = intPart.replace(/,/g, '') + fraction.slice(1);
  if (digits.length > MAX_DIGITS) return null;

  const magnitude = Number(intPart.replace(/,/g, '') + fraction);
  const isNegative = Boolean(minus || open);
  return {
    value: isNegative ? -magnitude : magnitude,
    format: numberFormat(intPart.includes(','), Math.max(0, fraction.length - 1), Boolean(open)),
  };
}

/** Converts extracted text into a typed, injection-safe cell value. */
export function toCellValue(text: string): CellValue {
  const parsed = text.includes('\n') ? null : parseNumber(text);
  return parsed ? { kind: 'number', ...parsed } : { kind: 'text', text: sanitize(text) };
}
