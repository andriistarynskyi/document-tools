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

/** Shows a determinate progress bar while a PDF is read. */
export function setProgress(target: HTMLElement, fraction: number, message: string): void {
  target.hidden = false;
  target.className = 'status busy';
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  const label = document.createElement('div');
  label.className = 'progress-label';
  label.textContent = `${message} ${pct}%`;

  const track = document.createElement('div');
  track.className = 'progress';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(pct));
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = `${pct}%`; // dynamic runtime value
  track.append(fill);

  target.replaceChildren(label, track);
}
