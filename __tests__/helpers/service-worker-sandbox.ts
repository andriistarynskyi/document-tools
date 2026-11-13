import vm from 'node:vm';

/** A minimal stand-in for `Request`, recording the URL and init the worker passes. */
export class FakeRequest {
  constructor(readonly url: string, readonly init: { cache?: string } = {}) {}
}

/** A minimal stand-in for `Response`. */
export class FakeResponse {
  status = 200;
  ok = true;
  type = 'basic';
  redirected = false;
  url = '';
  constructor(readonly body: string, overrides: Partial<FakeResponse> = {}) {
    Object.assign(this, overrides);
  }
  clone(): FakeResponse {
    return new FakeResponse(this.body, this);
  }
  static redirect(url: string, status: number): FakeResponse {
    return new FakeResponse('', { status, url, ok: false });
  }
}

export type FetchImpl = (input: unknown, init?: unknown) => Promise<FakeResponse>;

type Listener = (event: Record<string, unknown>) => void;

/**
 * Loads a rendered service worker into a sandbox with fake caches and fetch, so its lifecycle
 * and fetch handling can be driven from tests without a browser.
 */
export function loadServiceWorker(source: string, existingCaches: string[] = []) {
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, Map<string, FakeResponse>>(existingCaches.map((n) => [n, new Map()]));
  const added: FakeRequest[][] = [];
  const fetchCalls: Array<{ input: unknown; init: unknown }> = [];
  let fetchImpl: FetchImpl = async () => new FakeResponse('network');

  const keyOf = (r: unknown): string => (r instanceof FakeRequest ? r.url : typeof r === 'string' ? r : String((r as { url: string }).url));
  const cacheFor = (name: string) => {
    const store = stores.get(name) ?? new Map<string, FakeResponse>();
    stores.set(name, store);
    return {
      addAll: async (reqs: FakeRequest[]) => { added.push(reqs); },
      put: async (key: unknown, res: FakeResponse) => { store.set(keyOf(key), res); },
      match: async (key: unknown) => store.get(keyOf(key)),
    };
  };
  const sandbox = {
    self: {
      addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
      location: { origin: 'https://example.github.io' },
    },
    caches: {
      open: async (name: string) => cacheFor(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
    fetch: (input: unknown, init?: unknown) => {
      fetchCalls.push({ input, init });
      return fetchImpl(input, init);
    },
    Request: FakeRequest,
    Response: FakeResponse,
    URL,
  };
  vm.runInNewContext(source, sandbox);

  async function dispatch(type: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    const pending: Promise<unknown>[] = [];
    let responded: Promise<unknown> | undefined;
    listeners[type]({ ...extra, waitUntil: (p: Promise<unknown>) => pending.push(p), respondWith: (p: Promise<unknown>) => { responded = p; } });
    const result = await responded;
    await Promise.all(pending);
    return result;
  }

  return {
    listeners,
    stores,
    added,
    fetchCalls,
    setFetch: (impl: FetchImpl) => { fetchImpl = impl; },
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    navigate: (url: string) => dispatch('fetch', { request: { url, method: 'GET', mode: 'navigate' } }),
  };
}
