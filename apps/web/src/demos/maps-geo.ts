/**
 * Shared, honest loading layer for the two map labs.
 *
 * Both labs render the *same* public-domain snapshot: Natural Earth 110m
 * admin-0 countries, served from this site's own origin (`/media/...`, backed by
 * R2). Only four properties survive in that snapshot and only those are read
 * here: `name` (Chinese when available, else English), `continent`, `pop`
 * (the estimate in this Natural Earth snapshot) and `iso`.
 *
 * Nothing is fabricated: if the fetch fails the labs show the failure, they
 * never fall back to synthetic geometry.
 */

export interface CountryProperties {
  id: string;
  name: string;
  continent: string;
  pop: number;
  iso: string;
}

export type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, CountryProperties>;
export type CountryCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, CountryProperties>;

export const LEAFLET_GEOJSON_URL = '/media/demos/leaflet/countries_60bc5282.geojson';
export const MAPLIBRE_GEOJSON_URL = '/media/demos/maplibre-gl/countries_60bc5282.geojson';

export const CONTINENTS = [
  '全部',
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
  'Seven seas (open ocean)',
] as const;

export const CONTINENT_LABELS: Record<string, string> = {
  Africa: '非洲',
  Asia: '亚洲',
  Europe: '欧洲',
  'North America': '北美洲',
  'South America': '南美洲',
  Oceania: '大洋洲',
  Antarctica: '南极洲',
  'Seven seas (open ocean)': '公海／属地',
};

export function continentLabel(key: string): string {
  return CONTINENT_LABELS[key] ?? key;
}

/** Stable hue per continent, so the same country always looks the same. */
export function continentHue(key: string): number {
  const keys = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica', 'Seven seas (open ocean)'];
  const index = keys.indexOf(key);
  return index < 0 ? 210 : (index * 47) % 360;
}

export interface LoadedCountries {
  collection: CountryCollection;
  features: CountryFeature[];
  /** Population range actually present in the data, used to scale the ramp. */
  maxPop: number;
  minPop: number;
  continents: string[];
  bytes: number;
}

/**
 * Abortable, same-origin fetch. Throws on any non-2xx so the caller can surface
 * the real HTTP status instead of quietly rendering nothing.
 */
export async function loadCountries(url: string, signal: AbortSignal): Promise<LoadedCountries> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
  const text = await response.text();
  const parsed = JSON.parse(text) as CountryCollection;
  if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('响应不是 GeoJSON FeatureCollection');
  }
  const features = parsed.features.filter(f => f?.geometry && f.properties).map((f, index) => ({...f, properties: {...f.properties, id: `${f.properties.iso}_${index}`}})) as CountryFeature[];
  let maxPop = 0;
  let minPop = Number.POSITIVE_INFINITY;
  const continents = new Set<string>();
  for (const feature of features) {
    const pop = Number(feature.properties.pop);
    if (Number.isFinite(pop)) {
      if (pop > maxPop) maxPop = pop;
      if (pop < minPop) minPop = pop;
    }
    continents.add(String(feature.properties.continent ?? ''));
  }
  return {
    collection: { type: 'FeatureCollection', features },
    features,
    maxPop: maxPop || 1,
    minPop: Number.isFinite(minPop) ? minPop : 0,
    continents: [...continents].filter(Boolean).sort(),
    bytes: new TextEncoder().encode(text).length,
  };
}

export function formatPop(pop: number): string {
  if (!Number.isFinite(pop)) return '—';
  return pop.toLocaleString('zh-CN');
}

/** "14.0 亿" / "3282 万" — keeps long numbers readable in tight popups. */
export function formatPopShort(pop: number): string {
  if (!Number.isFinite(pop)) return '—';
  if (pop >= 1e8) return `${(pop / 1e8).toFixed(2)} 亿`;
  if (pop >= 1e4) return `${(pop / 1e4).toFixed(1)} 万`;
  return pop.toLocaleString('zh-CN');
}
