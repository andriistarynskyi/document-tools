// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PREVIEW_ROW_LIMIT, renderPreview } from '../../src/app/preview';
import type { SheetBlock } from '../../src/export/sheet-layout';

function block(id: string, rows: string[][], merges: SheetBlock['merges'] = []): SheetBlock {
  return { kind: 'table', id, title: `Title ${id}`, rows, merges, boldRows: [0] };
}

const BLOCKS = [block('table-1', [['Item', 'Qty'], ['Bolt', '1']]), block('table-2', [['A', 'B'], ['c', 'd']])];

let container: HTMLElement;
const excluded = new Set<string>();

/** Mirrors ReviewDialog: toggling flips the set and re-renders. */
function render(): void {
  renderPreview(container, BLOCKS, {
    excluded,
    onToggle: (id) => {
      if (excluded.has(id)) excluded.delete(id);
      else excluded.add(id);
      render();
    },
  });
}

const toggle = (id: string) => container.querySelector<HTMLButtonElement>(`button[data-block-id="${id}"]`);

beforeEach(() => {
  excluded.clear();
  container = document.createElement('div');
  document.body.replaceChildren(container);
  render();
});

describe('renderPreview', () => {
  it('keeps keyboard focus on the same block toggle after it is pressed', () => {
    toggle('table-2')?.focus();
    toggle('table-2')?.click();
    expect(document.activeElement).toBe(toggle('table-2'));
    expect(toggle('table-2')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps focus across include and exclude', () => {
    toggle('table-1')?.focus();
    toggle('table-1')?.click();
    toggle('table-1')?.click();
    expect(document.activeElement).toBe(toggle('table-1'));
    expect(toggle('table-1')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not steal focus when nothing in the preview was focused', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    render();
    expect(document.activeElement).toBe(outside);
  });

  it('writes PDF text as text, never as HTML', () => {
    renderPreview(container, [block('x', [['<img src=x onerror=alert(1)>']])], { excluded, onToggle: () => undefined });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('th')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('clamps a merged cell that runs past the preview row limit', () => {
    const rows = Array.from({ length: PREVIEW_ROW_LIMIT + 5 }, (_, i) => [`r${i}`, '']);
    const merges = [{ row: PREVIEW_ROW_LIMIT - 2, col: 0, rowSpan: 4, colSpan: 1 }];
    renderPreview(container, [block('big', rows, merges)], { excluded, onToggle: () => undefined });
    expect(container.querySelectorAll('tr')).toHaveLength(PREVIEW_ROW_LIMIT);
    const spanning = [...container.querySelectorAll('td')].find((td) => td.textContent === `r${PREVIEW_ROW_LIMIT - 2}`);
    expect(spanning?.rowSpan).toBe(2);
    expect(container.textContent).toContain('5 more rows are not shown here but will be downloaded.');
  });
});
