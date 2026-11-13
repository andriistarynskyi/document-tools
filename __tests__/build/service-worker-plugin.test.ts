import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { FakeResponse, loadServiceWorker } from '../helpers/service-worker-sandbox';

// The plugin is a CommonJS build script (used by webpack.config.js), not app code.
const require = createRequire(import.meta.url);
const { renderServiceWorker } = require('../../build/service-worker-plugin.js') as {
  renderServiceWorker(template: string, o: { cachePrefix: string; buildHash: string; shell: string[] }): string;
};

const TEMPLATE = readFileSync('public/sw.js', 'utf8');
const OPTIONS = { cachePrefix: 'pdf-tables-', buildHash: 'abc123', shell: ['./', './main.1a2b.js', './main.3c4d.css'] };
const SOURCE = renderServiceWorker(TEMPLATE, OPTIONS);
const CACHE = 'pdf-tables-abc123';
const PAGE = 'https://example.github.io/document-tools/';

describe('renderServiceWorker', () => {
  it('fills every placeholder', () => {
    expect(SOURCE).not.toMatch(/__[A-Z_]+__/);
    expect(SOURCE).toContain('"abc123"');
    expect(SOURCE).toContain('["./","./main.1a2b.js","./main.3c4d.css"]');
  });

  it('fails the build when the template lost a placeholder', () => {
    expect(() => renderServiceWorker('const CACHE = 1;', OPTIONS)).toThrow(/missing __CACHE_PREFIX__/);
  });
});

describe('service worker lifecycle', () => {
  it('installs the app shell from the server, bypassing the HTTP cache', async () => {
    const sw = loadServiceWorker(SOURCE);
    await sw.install();
    expect(sw.added).toHaveLength(1);
    expect(sw.added[0].map((r) => r.url)).toEqual(OPTIONS.shell);
    expect(sw.added[0].every((r) => r.init.cache === 'reload')).toBe(true);
    expect([...sw.stores.keys()]).toEqual([CACHE]);
  });

  it('deletes caches of older builds but leaves unrelated caches alone', async () => {
    const sw = loadServiceWorker(SOURCE, ['pdf-tables-v1', 'pdf-tables-old999', 'other-app']);
    await sw.install();
    await sw.activate();
    expect([...sw.stores.keys()].sort()).toEqual(['other-app', CACHE]);
  });
});

describe('service worker navigations', () => {
  it('revalidates the page with the server instead of trusting the HTTP cache', async () => {
    const sw = loadServiceWorker(SOURCE);
    sw.setFetch(async () => new FakeResponse('new page'));
    const response = (await sw.navigate(PAGE)) as FakeResponse;
    expect(response.body).toBe('new page');
    expect(sw.fetchCalls).toEqual([{ input: PAGE, init: { cache: 'no-cache', credentials: 'same-origin' } }]);
  });

  it('keeps the latest page as the offline copy', async () => {
    const sw = loadServiceWorker(SOURCE);
    sw.setFetch(async () => new FakeResponse('new page'));
    await sw.navigate(PAGE);
    expect(sw.stores.get(CACHE)?.get('./')?.body).toBe('new page');
  });

  it('serves the cached page when offline', async () => {
    const sw = loadServiceWorker(SOURCE);
    sw.setFetch(async () => new FakeResponse('online page'));
    await sw.navigate(PAGE);
    sw.setFetch(async () => { throw new TypeError('Failed to fetch'); });
    expect(((await sw.navigate(PAGE)) as FakeResponse).body).toBe('online page');
  });

  it('fails the navigation when offline with nothing cached', async () => {
    const sw = loadServiceWorker(SOURCE);
    sw.setFetch(async () => { throw new TypeError('Failed to fetch'); });
    await expect(sw.navigate(PAGE)).rejects.toThrow('Failed to fetch');
  });

  it('answers a followed redirect with a real redirect, and does not cache it', async () => {
    const sw = loadServiceWorker(SOURCE);
    sw.setFetch(async () => new FakeResponse('page', { redirected: true, url: PAGE }));
    const response = (await sw.navigate('https://example.github.io/document-tools')) as FakeResponse;
    expect(response.status).toBe(302);
    expect(response.url).toBe(PAGE);
    expect(sw.stores.get(CACHE)?.size ?? 0).toBe(0);
  });
});
