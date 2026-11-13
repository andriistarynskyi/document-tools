const MIN_ROWS = 2;
const MIN_FILL_RATIO = 0.35;
/** Strictly numeric-looking: digits plus separators / currency / percent, no letters. */
const NUMERIC_CELL = /^[^A-Za-z]*\d[^A-Za-z]*$/;
const MIN_NUMERIC_RATIO = 0.5;

function fillRatio(rows: readonly string[][]): number {
  const total = rows.length * rows[0].length;
  return rows.reduce((n, r) => n + r.filter(Boolean).length, 0) / total;
}

/** True when at least one column (below the header row) is mostly numeric. */
function hasNumericColumn(rows: readonly string[][]): boolean {
  const body = rows.slice(1);
  return rows[0].some((_, col) => {
    const filled = body.map((r) => r[col]).filter(Boolean);
    return filled.length > 0 && filled.filter((c) => NUMERIC_CELL.test(c)).length / filled.length >= MIN_NUMERIC_RATIO;
  });
}

/**
 * Filters out layouts that merely look tabular. Two-column text (address blocks, key/value
 * lists, newspaper columns) is accepted only when a column is numeric, which is what real
 * two-column data tables (label + amount) have.
 */
export function isLikelyTable(rows: readonly string[][]): boolean {
  if (rows.length < MIN_ROWS || rows[0].length < 2) return false;
  if (fillRatio(rows) < MIN_FILL_RATIO) return false;
  return rows[0].length >= 3 || hasNumericColumn(rows);
}
