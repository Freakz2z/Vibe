import { IS_TOY } from '../../lib/runtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/maps.css';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Range, Select, Segmented, Stat, Stats, Status, useStableId, useThemeColors } from '../lab-kit';
import {
  CONTINENTS,
  LEAFLET_GEOJSON_URL,
  continentHue,
  continentLabel,
  formatPop,
  formatPopShort,
  loadCountries,
  type CountryCollection,
  type CountryFeature,
  type LoadedCountries,
} from '../maps-geo';

const LEAFLET_VERSION = '1.9.4';

type Rgb = [number, number, number];

type Palette = {
  accent: Rgb;
  surface: Rgb;
  surface2: Rgb;
  ink: Rgb;
  line: Rgb;
  dark: boolean;
  /** Largest `pop` present in the snapshot — drives the log ramp. */
  maxPop: number;
};

/** Reads any CSS colour value (hex / rgb() / hsl() / var-resolved) via canvas. */
function parseCssColor(value: string, fallback: Rgb): Rgb {
  if (typeof document === 'undefined') return fallback;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.fillStyle = '#000000';
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

function mixColor(from: Rgb, to: Rgb, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const channel = (a: number, b: number) => Math.round(a + (b - a) * k);
  return `rgb(${channel(from[0], to[0])},${channel(from[1], to[1])},${channel(from[2], to[2])})`;
}

function hslToRgb(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[Math.floor(hp) % 6];
  return `rgb(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)})`;
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Real WGS84 bbox of one feature, walked from the raw coordinate arrays. */
function featureBounds(feature: CountryFeature): L.LatLngBounds | null {
  let south = 90;
  let west = 180;
  let north = -90;
  let east = -180;
  let seen = false;
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lng, lat] = node as [number, number];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      seen = true;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      return;
    }
    for (const child of node) walk(child);
  };
  if ('coordinates' in feature.geometry) walk(feature.geometry.coordinates);
  return seen ? L.latLngBounds([south, west], [north, east]) : null;
}

function collectionBounds(features: readonly CountryFeature[]): L.LatLngBounds | null {
  let box: L.LatLngBounds | null = null;
  for (const feature of features) {
    const b = featureBounds(feature);
    if (b) box = box ? box.extend(b) : b;
  }
  return box;
}

const EMPTY_COLLECTION: CountryCollection = { type: 'FeatureCollection', features: [] };

/* --------------------------------------------------------- style callbacks */

/** Style bound to the feature's real `continent` string. */
function continentStyle(palette: Palette): L.StyleFunction {
  return (feature?: GeoJSON.Feature | null): L.PathOptions => {
    const key = String(feature?.properties?.continent ?? '');
    return {
      color: mixColor(palette.line, palette.ink, 0.55),
      weight: 0.6,
      opacity: 0.85,
      fillColor: hslToRgb(continentHue(key), 0.55, palette.dark ? 0.46 : 0.62),
      fillOpacity: 0.82,
    };
  };
}

/** Style bound to the feature's real `pop` integer, on a log ramp. */
function popStyle(palette: Palette): L.StyleFunction {
  return (feature?: GeoJSON.Feature | null): L.PathOptions => {
    const t = popRatio(Number(feature?.properties?.pop ?? 0), palette.maxPop);
    return {
      color: mixColor(palette.line, palette.ink, 0.35),
      weight: 0.5,
      opacity: 0.8,
      fillColor: mixColor(palette.surface2, palette.accent, t),
      fillOpacity: 0.25 + t * 0.6,
    };
  };
}

function popRatio(pop: number, maxPop: number): number {
  if (!Number.isFinite(pop) || pop <= 0) return 0;
  return Math.max(0, Math.min(1, Math.log10(pop) / Math.log10(Math.max(10, maxPop))));
}

function bindPopup(feature: CountryFeature, layer: L.Layer): void {
  const p = feature.properties;
  (layer as L.Path).bindPopup(
    [
      `<span class="lab-leaflet-popup-name">${escapeHtml(p.name)}</span>`,
      row('洲', continentLabel(p.continent)),
      row('人口', `${formatPop(p.pop)}（${formatPopShort(p.pop)}）`),
      row('ISO', p.iso),
    ].join(''),
    { maxWidth: 280, autoPan: true },
  );
}

function row(key: string, value: string): string {
  return `<span class="lab-leaflet-popup-row"><span>${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></span>`;
}

type Variant = 'continent' | 'pop';
const VARIANT_LABEL: Record<Variant, string> = { continent: '按洲着色', pop: '按人口着色' };
const VARIANT_OPTIONS: readonly (readonly [Variant, string])[] = [
  ['continent', VARIANT_LABEL.continent],
  ['pop', VARIANT_LABEL.pop],
];

/**
 * Leaflet 1.9 in its default Web-Mercator CRS (`L.CRS.EPSG3857`) — not
 * `CRS.Simple`. No tile server is used; everything drawn on the map is the
 * site's own Natural Earth 110m country snapshot served from `/media/...`, and
 * every style is bound to that data's real `pop` / `continent` / `iso`
 * properties. If that fetch fails the demo shows the failure — it never
 * substitutes invented geometry.
 */
export default function LeafletLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const continentLayerRef = useRef<L.GeoJSON | null>(null);
  const popLayerRef = useRef<L.GeoJSON | null>(null);
  const layerByIsoRef = useRef(new Map<string, L.Layer>());

  const [data, setData] = useState<LoadedCountries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [continent, setContinent] = useState<string>('全部');
  const [variant, setVariant] = useState<Variant>('continent');
  const [zoom, setZoom] = useState(1);
  const [viewText, setViewText] = useState('—');
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [attempt, setAttempt] = useState(0);
  const themeKey = useStableId('leaflet');

  const palette = useMemo<Palette>(() => {
    const accent = parseCssColor(colors.accent ?? '#e2725b', [226, 114, 91]);
    const surface = parseCssColor(colors.surface ?? '#ffffff', [255, 255, 255]);
    const surface2 = parseCssColor(colors['surface-2'] ?? '#f2f2f0', [242, 242, 240]);
    const ink = parseCssColor(colors.ink ?? '#222222', [34, 34, 34]);
    const line = parseCssColor(colors.line ?? '#dddddd', [221, 221, 221]);
    const lum = 0.2126 * surface[0] + 0.7152 * surface[1] + 0.0722 * surface[2];
    return { accent, surface, surface2, ink, line, dark: lum < 128, maxPop: data?.maxPop ?? 1 };
  }, [colors, data]);

  /* ---------------------------------------------- real, abortable fetch */

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    loadCountries(LEAFLET_GEOJSON_URL, controller.signal)
      .then((loaded) => {
        if (!alive) return;
        setData(loaded);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!alive || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [attempt, themeKey]);

  /* ---------------------------------------- map + layers (built once) */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let map: L.Map;
    try {
      map = L.map(host, {
        crs: L.CRS.EPSG3857,
        minZoom: 0,
        maxZoom: 8,
        zoomControl: true,
        attributionControl: false,
        worldCopyJump: false,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        maxBoundsViscosity: 0.9,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    mapRef.current = map;

    new L.Control.Attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('Natural Earth 110m · Public Domain')
      .addTo(map);

    const continentLayer = L.geoJSON(EMPTY_COLLECTION, { style: continentStyle(palette), onEachFeature: bindPopup });
    const popLayer = L.geoJSON(EMPTY_COLLECTION, { style: popStyle(palette), onEachFeature: bindPopup });
    continentLayerRef.current = continentLayer;
    popLayerRef.current = popLayer;
    continentLayer.addTo(map);

    const control = L.control.layers({ [VARIANT_LABEL.continent]: continentLayer, [VARIANT_LABEL.pop]: popLayer }, {}, { position: 'topright' }).addTo(map);

    // Only one styling variant is ever on the map: enabling one drops the other.
    const onOverlay = (event: L.LayersControlEvent) => {
      const target = event.layer as L.Layer;
      const other = target === popLayer ? continentLayer : popLayer;
      if (map.hasLayer(other)) map.removeLayer(other);
      setVariant(target === popLayer ? 'pop' : 'continent');
    };
    map.on('baselayerchange', onOverlay);

    const report = () => {
      setViewText(map.getBounds().toBBoxString());
      setZoom(map.getZoom());
    };
    const onView = () => report();
    map.on('zoomend moveend', onView);

    map.setView([15, 10], 1);
    report();

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(host);

    return () => {
      observer.disconnect();
      map.off('baselayerchange', onOverlay);
      map.off('zoomend', onView);
      map.off('moveend', onView);
      control.remove();
      continentLayer.remove();
      popLayer.remove();
      map.remove();
      mapRef.current = null;
      continentLayerRef.current = null;
      popLayerRef.current = null;
      layerByIsoRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey]);

  /* ------------------------------- real re-filtering on the filter state */

  useEffect(() => {
    const continentLayer = continentLayerRef.current;
    const popLayer = popLayerRef.current;
    if (!continentLayer || !popLayer) return;
    const features = data ? (continent === '全部' ? data.features : data.features.filter((f) => f.properties.continent === continent)) : [];
    const collection: CountryCollection = { type: 'FeatureCollection', features };

    continentLayer.options.style = continentStyle(palette);
    popLayer.options.style = popStyle(palette);
    continentLayer.clearLayers();
    popLayer.clearLayers();
    continentLayer.addData(collection);
    popLayer.addData(collection);

    layerByIsoRef.current.clear();
    for (const geoLayer of [continentLayer, popLayer]) geoLayer.eachLayer((layer) => {
      const feature = (layer as L.GeoJSON & { feature?: CountryFeature }).feature;
      const iso = feature?.properties.id;
      if (!feature || !iso) return;
      layerByIsoRef.current.set(iso, layer);
      // Clicking a country really zooms to its own boundary.
      layer.on('click', () => {
        const bounds = featureBounds(feature);
        if (bounds) mapRef.current?.fitBounds(bounds, { padding: [24, 24], maxZoom: 5, animate: true });
        setSelected(feature);
      });
    });
    // `palette` carries the theme colours + the real max pop, so restyle on change.
  }, [data, continent, palette]);

  /* ------- frame the camera on whatever the filter currently selects ------ */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const features = continent === '全部' ? data.features : data.features.filter((f) => f.properties.continent === continent);
    const box = collectionBounds(features);
    if (box) map.fitBounds(box, { padding: [10, 10] });
  }, [data, continent, themeKey]);

  /* --------------------------------------------------------------- actions */

  const focusIso = useCallback((iso: string) => {
    const map = mapRef.current;
    const layer = layerByIsoRef.current.get(iso);
    const feature = (layer as (L.GeoJSON & { feature?: CountryFeature }) | undefined)?.feature;
    if (!map || !layer || !feature) return;
    const bounds = featureBounds(feature);
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 5, animate: true });
    setSelected(feature);
  }, []);

  const showVariant = useCallback((next: Variant) => {
    const map = mapRef.current;
    const continentLayer = continentLayerRef.current;
    const popLayer = popLayerRef.current;
    if (map && continentLayer && popLayer) {
      if (next === 'pop') {
        if (!map.hasLayer(popLayer)) map.addLayer(popLayer);
        if (map.hasLayer(continentLayer)) map.removeLayer(continentLayer);
      } else {
        if (!map.hasLayer(continentLayer)) map.addLayer(continentLayer);
        if (map.hasLayer(popLayer)) map.removeLayer(popLayer);
      }
    }
    setVariant(next);
  }, []);

  const reset = useCallback(() => {
    setContinent('全部');
    mapRef.current?.setView([15, 10], 1);
    setSelected(null);
    showVariant('continent');
  }, [showVariant]);

  const changeZoom = (value: number) => mapRef.current?.setZoom(value);

  const visibleCount = useMemo(() => {
    if (!data) return 0;
    return continent === '全部' ? data.features.length : data.features.filter((f) => f.properties.continent === continent).length;
  }, [data, continent]);

  const ranked = useMemo(() => {
    if (!data) return [];
    const rows = continent === '全部' ? data.features : data.features.filter((f) => f.properties.continent === continent);
    return [...rows].sort((a, b) => b.properties.pop - a.properties.pop).slice(0, 12);
  }, [data, continent]);

  const extent = useMemo(() => (data ? collectionBounds(data.features)?.toBBoxString() ?? '—' : '—'), [data]);

  const snippet = useMemo(
    () =>
      [
        `// 真地理 CRS：Web 墨卡托 EPSG:3857，不是 CRS.Simple`,
        `const map = L.map(host, { crs: L.CRS.EPSG3857, minZoom: 0, maxZoom: 8 });`,
        `new L.Control.Attribution({ prefix: false }).addAttribution('Natural Earth 110m · Public Domain').addTo(map);`,
        ``,
        IS_TOY ? '// 同源加载随包分发的 Natural Earth 110m 国家边界（177 个要素）' : `// 同源取本站 R2 上的 Natural Earth 110m 国家边界（177 个要素，可中止）`,
        `const controller = new AbortController();`,
        `const res = await fetch('${LEAFLET_GEOJSON_URL}', { signal: controller.signal });`,
        `const countries = await res.json();   // properties: { name, continent, pop, iso }`,
        ``,
        `// 样式绑定到要素自身的 pop 属性（对数刻度），另一路绑定 continent`,
        `const byPop = L.geoJSON(undefined, {`,
        `  style: (f) => ({`,
        `    fillColor: mix(surface2, accent, t),`,
        `    fillOpacity: 0.25 + 0.6 * t,     // t = log10(pop) / log10(maxPop)`,
        `    color: ink, weight: 0.5,`,
        `  }),`,
        `});`,
        ``,
        `// 洲过滤：clearLayers + addData 真的换掉渲染出来的图层`,
        `byPop.clearLayers();`,
        `byPop.addData({ type: 'FeatureCollection', features: countries.features.filter(f => f.properties.continent === key) });`,
        ``,
        `// 两种着色方式放进真正的图层面板`,
        `L.control.layers({ '按洲着色': byContinent, '按人口着色': byPop }, {}, { position: 'topright' }).addTo(map);`,
        ``,
        `// 点击国家 -> fitBounds + bindPopup（读真实 name / pop / continent / iso）`,
        `layer.bindPopup(\`<strong>\${f.properties.name}</strong>\`);`,
        `layer.on('click', () => map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 5 }));`,
        ``,
        `map.invalidateSize();   // 容器尺寸变化后必须调用`,
        `map.remove();          // 必须移除`,
      ].join('\n'),
    [],
  );

  return (
    <Lab title="Leaflet 国家边界与图层" badge={<span className="demo-live-badge">Leaflet {LEAFLET_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <Select
              label="洲过滤"
              value={continent}
              options={CONTINENTS.map((c) => [c, c === '全部' ? '全部' : continentLabel(c)] as [string, string])}
              onChange={setContinent}
            />
            <Segmented label="着色方式" value={variant} options={VARIANT_OPTIONS} onChange={showVariant} />
            <Range label="缩放级别" value={zoom} min={0} max={8} step={0.5} onChange={changeZoom} hint="调用 map.setZoom()，相机同步回读。" />
            <Status tone={data ? 'ok' : 'warn'}>
              当前显示 <strong>{visibleCount}</strong> / {data?.features.length ?? '—'} 个国家要素。
            </Status>
            <Status>数据实际地理范围 <code>{extent}</code>（由要素坐标算出，非写死）。</Status>
            <Status>当前视野 <code>{viewText}</code>，来自 map.getBounds().toBBoxString()。</Status>
          </>
        }
      >
        {error ? (
          <ErrorNote onRetry={() => { setError(null); setAttempt((n) => n + 1); }}>{`加载 ${LEAFLET_GEOJSON_URL} 失败：${error}`}</ErrorNote>
        ) : null}

        <div className="lab-leaflet-map" ref={hostRef} role="img" aria-label="Natural Earth 世界国家边界（Leaflet）" />

        {loading && !error ? (
          <div className="lab-leaflet-overlay" role="status">
            <span>{IS_TOY ? '正在加载包内国家边界…' : '正在从本站 R2 加载 Natural Earth 110m 国家边界…'}</span>
            <code>{LEAFLET_GEOJSON_URL}</code>
          </div>
        ) : null}
        {error ? (
          <div className="lab-leaflet-overlay" role="alert">
            <span>国家边界数据加载失败，请重试。</span>
          </div>
        ) : null}
        {data ? (
          <span className="lab-leaflet-badge">
            Natural Earth 110m · {data.features.length} 个要素 · {(data.bytes / 1024).toFixed(0)} KB · 公有领域
          </span>
        ) : null}

        <div className="lab-leaflet-rank" style={{ marginTop: 12 }} aria-label="按人口排序的国家">
          {ranked.map((feature) => (
            <button
              key={feature.properties.id}
              type="button"
              className="lab-leaflet-chip"
              aria-pressed={selected?.properties.id === feature.properties.id}
              onClick={() => focusIso(feature.properties.id)}
            >
              <i style={{ background: mixColor(palette.surface2, palette.accent, popRatio(feature.properties.pop, palette.maxPop)) }} />
              <b>{feature.properties.name}</b>
              <em>{formatPopShort(feature.properties.pop)}</em>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="国家要素" value={data?.features.length ?? '—'} />
            <Stat label="当前可见" value={data ? visibleCount : '—'} />
            <Stat label="最大人口" value={data ? formatPopShort(data.maxPop) : '—'} />
            <Stat label="缩放" value={zoom.toFixed(2)} />
          </Stats>
        </div>

        {selected ? (
          <p className="lab-mermaid-note" style={{ marginTop: 12 }}>
            选中 <strong>{selected.properties.name}</strong>（{selected.properties.iso}）· {continentLabel(selected.properties.continent)} · 人口{' '}
            {formatPop(selected.properties.pop)}，视野已 fitBounds 到该国实际边界。
          </p>
        ) : null}
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        <DataTable
          head={['国家', 'ISO', '洲', '人口']}
          rows={ranked.map((f) => [f.properties.name, f.properties.iso, continentLabel(f.properties.continent), formatPop(f.properties.pop)])}
          caption="Natural Earth 数据快照，按估计人口排序；非实时统计"
        />
      </div>

      <Code text={snippet} onCopy={onCopy} label="Leaflet 调用" />
    </Lab>
  );
}
