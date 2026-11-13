import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// The plugin is a CommonJS build script (used by webpack.config.js), not app code.
const require = createRequire(import.meta.url);
const { renderServiceWorker } = require('../../build/service-worker-plugin.js') as {
  renderServiceWorker(template: string, o: { cachePrefix: string; buildHash: string; shell: string[] }): string;
};

const TEMPLATE = readFileSync('public/sw.js', 'utf8');
const OPTIONS = { cachePrefix: 'pdf-tables-', buildHash: 'abc123', shell: ['./', './main.1a2b.js', './main.3c4d.css'] };

type Listener = (event: { waitUntil(p: Promise<unknown>): void }) => void;

/** Runs the rendered worker in a sandbox with fake caches and records what it does. */
async function simulate(existingCaches: string[]) {
  const listeners: Record<string, Listener> = {};
  const caches = new Set(existingCaches);
  const added: string[][] = [];
  const self = {
    addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    location: { origin: 'https://example.github.io' },
  };
  const cacheApi = {
    open: async (name: string) => {
      caches.add(name);
      return { addAll: async (urls: string[]) => { added.push(urls); } };
    },
    keys: async () => [...caches],
    delete: async (name: string) => caches.delete(name),
  };
  vm.runInNewContext(renderServiceWorker(TEMPLATE, OPTIONS), { self, caches: cacheApi, URL });
  for (const type of ['install', 'activate']) {
    const pending: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  }
  return { caches: [...caches].sort(), added, listeners: Object.keys(listeners).sort() };
}

describe('renderServiceWorker', () => {
  it('fills every placeholder', () => {
    const sw = renderServiceWorker(TEMPLATE, OPTIONS);
    expect(sw).not.toMatch(/__[A-Z_]+__/);
    expect(sw).toContain('"abc123"');
    expect(sw).toContain('["./","./main.1a2b.js","./main.3c4d.css"]');
  });

  it('fails the build when the template lost a placeholder', () => {
    expect(() => renderServiceWorker('const CACHE = 1;', OPTIONS)).toThrow(/missing __CACHE_PREFIX__/);
  });
});

describe('rendered service worker', () => {
  it('caches the app shell under a cache named after the build', async () => {
    const { added, caches } = await simulate([]);
    expect(added).toEqual([OPTIONS.shell]);
    expect(caches).toEqual(['pdf-tables-abc123']);
  });

  it('deletes caches of older builds but leaves unrelated caches alone', async () => {
    const { caches } = await simulate(['pdf-tables-v1', 'pdf-tables-old999', 'other-app']);
    expect(caches).toEqual(['other-app', 'pdf-tables-abc123']);
  });

  it('handles install, activate and fetch', async () => {
    expect((await simulate([])).listeners).toEqual(['activate', 'fetch', 'install']);
  });
});
