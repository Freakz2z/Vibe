import type { Catalog } from '../shared/contracts';
import { safeJson } from './bootstrap';

export const siteTitle = 'Vibe 工具集 · 独立开发者的中文工具导航';
export const siteDescription = '面向独立开发者的中文工具导航，收录 AI 编程、前端、动画、图表、后端与效率工具，提供可在浏览器操作的专属示例。';
export const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
export function pageSeo(catalog: Catalog, path: string, origin: string) {
  const tool = catalog.tools.find(item => path === '/tools/' + encodeURIComponent(item.id));
  const demo = catalog.demos.find(item => path === '/demos/' + encodeURIComponent(item.id));
  const title = tool ? tool.name + ' · Vibe 工具集' : demo ? demo.name + ' · 站内示例 · Vibe 工具集' : path === '/demos' ? '站内示例 · Vibe 工具集' : siteTitle;
  const description = tool?.tagline || demo?.description || (path === '/demos' ? '在浏览器里真实运行的工具示例：动画、图表、编辑、状态与本站服务接口。' : siteDescription);
  const canonical = origin + path;
  const itemList = path === '/' ? catalog.tools.map(item => ({ name: item.name, url: origin + '/tools/' + encodeURIComponent(item.id) })) : path === '/demos' ? catalog.demos.map(item => ({ name: item.name, url: origin + '/demos/' + encodeURIComponent(item.id) })) : null;
  const page = {
    '@type': itemList ? 'CollectionPage' : 'WebPage', '@id': canonical + '#webpage', url: canonical,
    name: title, description, inLanguage: 'zh-CN', isPartOf: { '@id': origin + '/#website' },
    ...(tool ? { about: { '@type': 'SoftwareApplication', name: tool.name, description: tool.description, url: tool.website, applicationCategory: catalog.categories.find(item => item.id === tool.categoryId)?.name, operatingSystem: tool.platforms.join(', ') } } : {}),
    ...(itemList ? { mainEntity: { '@type': 'ItemList', numberOfItems: itemList.length, itemListElement: itemList.map((item, index) => ({ '@type': 'ListItem', position: index + 1, ...item })) } } : {}),
  };
  const structured = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', '@id': origin + '/#website', name: 'Vibe 工具集', url: origin + '/', inLanguage: 'zh-CN' }, page] };
  return { title, description, canonical, structured: `<script type="application/ld+json">${safeJson(structured)}</script>` };
}
export function sitemap(catalog: Catalog, origin: string): string {
  const paths = ['/', '/demos', ...catalog.tools.map(item => '/tools/' + encodeURIComponent(item.id)), ...catalog.demos.map(item => '/demos/' + encodeURIComponent(item.id))];
  const lastmod = /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(catalog.updatedAt) && Number.isFinite(Date.parse(catalog.updatedAt)) ? `<lastmod>${escapeXml(catalog.updatedAt)}</lastmod>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${escapeXml(origin + path)}</loc>${lastmod}</url>`).join('')}</urlset>`;
}
