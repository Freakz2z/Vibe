import {labFetch, type LabEnv} from './labs';

export interface ToyLabEnv extends LabEnv { TOY_ALLOWED_ORIGINS?: string; }
const methods = new Set(['GET', 'HEAD']);
const allowedHeaders = new Set([
  'accept', 'range', 'if-range', 'if-none-match', 'hx-request', 'hx-current-url',
  'hx-target', 'hx-trigger', 'hx-trigger-name', 'hx-boosted',
]);
export function toyOriginAllowed(origin: string, configured = 'https://www.bilibili.com,https://www.bilibilitoy.com'): boolean {
  return configured.split(',').map(value => value.trim()).filter(Boolean).includes(origin);
}
/** Separate public, read-only CORS surface. Visitor writes never pass through here. */
export async function toyLabFetch(request: Request, env: ToyLabEnv): Promise<Response> {
  const origin = request.headers.get('Origin');
  const reject = (error: string, status: number) => Response.json({error}, {status, headers: {'Cache-Control': 'no-store', Vary: 'Origin'}});
  if (origin && !toyOriginAllowed(origin, env.TOY_ALLOWED_ORIGINS)) return reject('ORIGIN_NOT_ALLOWED', 403);
  let response: Response;
  if (request.method === 'OPTIONS') {
    if (!origin || !methods.has(request.headers.get('Access-Control-Request-Method') || '')) return reject('METHOD_NOT_ALLOWED', 405);
    const requested = (request.headers.get('Access-Control-Request-Headers') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (requested.some(value => !allowedHeaders.has(value))) return reject('HEADER_NOT_ALLOWED', 403);
    response = new Response(null, {status: 204});
  } else {
    if (!methods.has(request.method)) return reject('METHOD_NOT_ALLOWED', 405);
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(/^\/api\/toy\/labs\//, '/api/labs/');
    response = await labFetch(new Request(url, request), env);
  }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', [...allowedHeaders].join(', '));
    headers.set('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Range, Accept-Ranges, X-Object-Key, X-Demo-Router, X-Request-Id');
    headers.set('Access-Control-Max-Age', '600');
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {status: response.status, headers});
}
