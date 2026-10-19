import type { Catalog } from '../types';

export class CatalogRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CatalogRequestError';
    this.status = status;
  }
}

function isCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Catalog>;
  return (
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.tools) &&
    Array.isArray(candidate.demos) &&
    typeof candidate.updatedAt === 'string'
  );
}

export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  let response: Response;
  try {
    response = await fetch('/api/catalog', {
      signal,
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new CatalogRequestError('没有连接到目录服务，请检查网络后重试。');
  }

  if (!response.ok) {
    throw new CatalogRequestError(`目录服务暂时不可用（${response.status}），请稍后重试。`, response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CatalogRequestError('目录数据格式异常，请稍后刷新。');
  }

  if (!isCatalog(payload)) {
    throw new CatalogRequestError('目录数据不完整，请稍后刷新。');
  }

  return payload;
}
