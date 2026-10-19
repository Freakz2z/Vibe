import { BUILD_REVISION } from '../shared/generated/build';

export interface CacheResult {
  response: Response;
  status: 'HIT' | 'MISS';
}
const inFlight = new Map<string, Promise<Response>>();

/** Public, complete 200 responses only. Keys exclude client headers and use the deployment revision. */
export async function cachedPublicResponse(
  origin: string,
  namespace: string,
  path: string,
  ttl: number,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  load: () => Promise<Response>,
): Promise<CacheResult> {
  const key = new Request(
    `${origin}/__vibe-cache/${BUILD_REVISION}/${namespace}/${encodeURIComponent(path)}`,
  );
  const cache = (caches as CacheStorage & { default: Cache }).default;
  try {
    const hit = await cache.match(key);
    if (hit) {
      const headers = new Headers(hit.headers);
      const policy = headers.get('X-Vibe-Client-Cache-Control');
      headers.delete('X-Vibe-Client-Cache-Control');
      if (policy) headers.set('Cache-Control', policy);
      else headers.delete('Cache-Control');
      return { response: new Response(hit.body, { status: hit.status, headers }), status: 'HIT' };
    }
  } catch {
    /* Cache availability must never be required for a successful origin read. */
  }
  const loadAndStore = () =>
    load().then((response) => {
      if (
        response.status === 200 &&
        !response.headers.has('Set-Cookie') &&
        !/private|no-store/i.test(response.headers.get('Cache-Control') ?? '')
      ) {
        const headers = new Headers(response.headers);
        headers.set('X-Vibe-Client-Cache-Control', response.headers.get('Cache-Control') ?? '');
        headers.set('Cache-Control', `public, max-age=${ttl}`);
        const stored = new Response(response.clone().body, { status: 200, headers });
        ctx.waitUntil(
          Promise.resolve()
            .then(() => cache.put(key, stored))
            .catch(() => {}),
        );
      }
      return response;
    });
  // Large R2 bodies must stream directly; sharing cloned, unread originals can buffer whole files.
  if (namespace !== 'catalog') return { response: await loadAndStore(), status: 'MISS' };
  let pending = inFlight.get(key.url);
  if (!pending) {
    pending = loadAndStore();
    inFlight.set(key.url, pending);
    void pending
      .finally(() => {
        if (inFlight.get(key.url) === pending) inFlight.delete(key.url);
      })
      .catch(() => {});
  }
  return { response: (await pending).clone(), status: 'MISS' };
}
