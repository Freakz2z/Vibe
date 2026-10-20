/** Anonymous browser counts. No IP address, user agent, referrer, or raw browser ID is stored. */
export function visitorDay(now = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export async function visitorHash(id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vibe-visitor-v1:' + id.toLowerCase()));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function visitorStats(request: Request, db: D1Database, publicOrigin = new URL(request.url).origin, extraOrigins: readonly string[] = []): Promise<Response> {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const day = visitorDay();
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
    const response = reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
    response.headers.set('Allow', 'GET, HEAD, POST'); return response;
  }
  const writes: D1PreparedStatement[] = [];
  if (request.method === 'POST') {
    const origin = request.headers.get('Origin');
    if ((!origin || ![publicOrigin, new URL(request.url).origin, ...extraOrigins].includes(origin)) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply({ error: 'INVALID_ORIGIN' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({ error: 'JSON_REQUIRED' }, 415);
    // Limit the streamed body as well as Content-Length (which can be absent or inaccurate).
    const reader = request.body?.getReader(); let body = '';
    if (reader) {
      const decoder = new TextDecoder(); let size = 0;
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
        if (size > 256) { await reader.cancel(); return reply({ error: 'BODY_TOO_LARGE' }, 413); }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    }
    let id: unknown; try { id = (JSON.parse(body) as { visitorId?: unknown })?.visitorId; } catch { return reply({ error: 'INVALID_BODY' }, 400); }
    const hash = await visitorHash(id); if (!hash) return reply({ error: 'INVALID_VISITOR_ID' }, 400);
    // Primary keys make retries and concurrent tabs idempotent; batch is transactional.
    writes.push(db.prepare('INSERT OR IGNORE INTO site_visitors (visitor_hash, first_day) VALUES (?, ?)').bind(hash, day));
    writes.push(db.prepare('INSERT OR IGNORE INTO site_daily_visitors (day, visitor_hash) VALUES (?, ?)').bind(day, hash));
  }
  const results = await db.batch([...writes,
    db.prepare('SELECT count(*) AS total, min(first_day) AS since FROM site_visitors'),
    db.prepare('SELECT count(*) AS today FROM site_daily_visitors WHERE day = ?').bind(day),
  ]);
  const total = results.at(-2)!.results[0] as { total: number; since: string | null };
  const today = results.at(-1)!.results[0] as { today: number };
  return reply({ total: total.total, today: today.today, day, since: total.since });
}
