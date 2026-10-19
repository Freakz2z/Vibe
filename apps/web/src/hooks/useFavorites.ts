import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'vibe-favorites';

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(readFavorites);
  const favoriteSet = new Set(ids);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // A full or blocked storage area should not break browsing.
    }
  }, [ids]);

  const toggle = useCallback(
    (id: string) => {
      const wasFavorite = ids.includes(id);
      setIds((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
      return !wasFavorite;
    },
    [ids],
  );

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, favoriteSet, isFavorite, toggle };
}
