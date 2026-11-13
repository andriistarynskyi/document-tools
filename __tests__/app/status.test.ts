// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { setProgress, setStatus } from '../../src/app/status';

let target: HTMLElement;

beforeEach(() => {
  target = document.createElement('div');
  target.setAttribute('role', 'status');
  document.body.replaceChildren(target);
});

const bar = () => target.querySelector('[role="progressbar"]');

describe('setProgress', () => {
  it('updates the same elements in place instead of rebuilding them', () => {
    setProgress(target, 0.1, 'Reading PDF…');
    const firstBar = bar();
    setProgress(target, 0.6, 'Reading PDF…');
    expect(bar()).toBe(firstBar);
    expect(bar()?.getAttribute('aria-valuenow')).toBe('60');
  });

  it('keeps the percentage out of the announced text', () => {
    setProgress(target, 0.42, 'Reading PDF…');
    const percent = target.querySelector('.progress-percent');
    expect(percent?.textContent).toBe('42%');
    expect(percent?.getAttribute('aria-hidden')).toBe('true');
    const label = target.querySelector('.progress-label > span:first-child');
    expect(label?.textContent).toBe('Reading PDF…');
  });

  it('gives the progressbar an accessible name and clamps the value', () => {
    setProgress(target, 1.7, 'Reading PDF…');
    expect(bar()?.getAttribute('aria-label')).toBe('Reading PDF…');
    expect(bar()?.getAttribute('aria-valuenow')).toBe('100');
    setProgress(target, -1, 'Reading PDF…');
    expect(bar()?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('rebuilds after a status message replaced the progress', () => {
    setProgress(target, 0.5, 'Reading PDF…');
    setStatus(target, 'error', 'Broken');
    setProgress(target, 0.2, 'Reading PDF…');
    expect(bar()?.getAttribute('aria-valuenow')).toBe('20');
  });
});

describe('setStatus', () => {
  it('hides the region for null', () => {
    setStatus(target, null);
    expect(target.hidden).toBe(true);
  });

  it('shows the message with the kind as a class', () => {
    setStatus(target, 'error', 'This file is empty.');
    expect(target.hidden).toBe(false);
    expect(target.className).toBe('status error');
    expect(target.textContent).toBe('This file is empty.');
  });
});
