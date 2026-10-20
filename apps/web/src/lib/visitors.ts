export interface VisitorStats { total: number; today: number; day: string; since: string | null; }
let pending: Promise<VisitorStats> | undefined;
let pendingDay = '';

/** One write per browser/day, even when the SPA footer remounts. Storage opt-out stays read-only. */
export function loadVisitorStats(): Promise<VisitorStats> {
  const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  if (pending && pendingDay === day) return pending;
  pendingDay = day;
  pending = (async () => {
    let id: string | null = null;
    let recorded = false;
    try {
      id = localStorage.getItem('vibe-visitor-id');
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) { id = crypto.randomUUID(); localStorage.setItem('vibe-visitor-id', id); }
      recorded = localStorage.getItem('vibe-visitor-day') === day;
    } catch { id = null; }
    const record = !!id && !recorded;
    const response = await fetch('/api/visitors', record ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: id }),
      cache: 'no-store',
    } : { cache: 'no-store' });
    if (!response.ok) throw new Error('Visitor statistics unavailable');
    const stats = await response.json() as VisitorStats;
    if (!Number.isSafeInteger(stats.total) || !Number.isSafeInteger(stats.today) || stats.total < 0 || stats.today < 0) throw new Error('Invalid statistics');
    if (record) { try { localStorage.setItem('vibe-visitor-day', stats.day); } catch { /* Optional storage. */ } }
    return stats;
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
