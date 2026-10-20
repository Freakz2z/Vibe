export interface PublicRouting {
  PUBLIC_ORIGIN?: string;
  CDN_ORIGIN_HOST?: string;
  CDN_TEST_ORIGIN?: string;
}
/** Only the dedicated CDN origin accepts an explicitly allowed forwarded host. */
export function publicRequestHost(request: Request, env: PublicRouting): string {
  const host = new URL(request.url).host;
  if (host !== env.CDN_ORIGIN_HOST) return host;
  const forwarded = request.headers.get('X-Vibe-Forwarded-Host');
  const allowed = [env.PUBLIC_ORIGIN, env.CDN_TEST_ORIGIN].filter((value): value is string => !!value).map(value => new URL(value).host);
  return forwarded && allowed.includes(forwarded) ? forwarded : host;
}
export function normalizedPageUrl(request: Request, env: PublicRouting): URL {
  const url = new URL(request.url);
  if (url.host === env.CDN_ORIGIN_HOST) {
    const host = publicRequestHost(request, env);
    const target = new URL(env.PUBLIC_ORIGIN || url.origin);
    url.protocol = target.protocol;
    url.host = host === env.CDN_ORIGIN_HOST ? target.host : host;
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}
