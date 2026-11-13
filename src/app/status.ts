export type StatusKind = 'busy' | 'error';

/** Shows a message (with a spinner while busy) in a live region, or hides it for `null`. */
export function setStatus(target: HTMLElement, kind: StatusKind | null, message = ''): void {
  target.hidden = kind === null;
  target.className = `status ${kind ?? ''}`;
  target.replaceChildren();
  if (kind === 'busy') {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    target.append(spinner);
  }
  target.append(document.createTextNode(message));
}

interface ProgressParts {
  label: HTMLElement;
  percent: HTMLElement;
  bar: HTMLElement;
  fill: HTMLElement;
}

function buildProgress(target: HTMLElement): ProgressParts {
  const row = document.createElement('div');
  row.className = 'progress-label';
  const label = document.createElement('span');
  const percent = document.createElement('span');
  percent.className = 'progress-percent';
  // The percentage is visual only; screen readers get it from the progressbar's value.
  percent.setAttribute('aria-hidden', 'true');
  row.append(label, percent);

  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  bar.append(fill);

  target.replaceChildren(row, bar);
  return { label, percent, bar, fill };
}

/** The progress elements already shown in `target`, if it currently displays progress. */
function existingProgress(target: HTMLElement): ProgressParts | null {
  const bar = target.querySelector<HTMLElement>('[role="progressbar"]');
  const label = target.querySelector<HTMLElement>('.progress-label > span:first-child');
  const percent = target.querySelector<HTMLElement>('.progress-percent');
  const fill = target.querySelector<HTMLElement>('.progress-fill');
  return bar && label && percent && fill ? { label, percent, bar, fill } : null;
}

/**
 * Shows a determinate progress bar while a PDF is read. Elements are created once and then
 * updated in place, and the live region only ever contains the label text, so assistive
 * technology announces "Reading PDF…" once instead of every percentage step.
 */
export function setProgress(target: HTMLElement, fraction: number, message: string): void {
  target.hidden = false;
  target.className = 'status busy';
  const parts = existingProgress(target) ?? buildProgress(target);
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  if (parts.label.textContent !== message) parts.label.textContent = message;
  parts.bar.setAttribute('aria-label', message);
  parts.bar.setAttribute('aria-valuenow', String(pct));
  parts.percent.textContent = `${pct}%`;
  parts.fill.style.width = `${pct}%`; // dynamic runtime value
}
