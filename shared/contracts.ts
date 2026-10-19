export interface Category { id: string; name: string; description: string; icon: string; }
export interface Tool {
 id: string; name: string; tagline: string; description: string; categoryId: string;
 website: string; github?: string; source?: string; install?: string; tags: string[];
 platforms: ('Web'|'Mobile'|'CLI')[]; pricing: '开源免费'|'免费使用'|'免费增值'|'付费';
 icon: string; logo?: string; logoDark?: string; logoOnDark?:boolean; accent: string; featured: boolean; demoId?: string;
 useCases: string[]; highlights: string[];
}
/**
 * 历史 kind 枚举，为兼容旧示例文件与既有类型保留。
 * catalog 只发布新的真实示例（kind 为 'library' 或 'service'），不再发布旧 kind。
 */
export const DEMO_KINDS = [
  'spring','chart','gradient','kanban','particles','markdown',
  'contrast','bezier','grid','shadow','typography','regex','json','csv','svgpath','image','flex','noise','sorting','debounce','cache',
  'form','state','http','sql','storage','editor','carousel','graph','map','testing','pipeline','command',
  'library','service',
] as const;
export type LegacyDemoKind = typeof DEMO_KINDS[number];
/** library = 真实调用第三方库/运行时；service = 真实调用本站只读服务接口。 */
export type DemoKind = 'library' | 'service';
export interface Demo {
 id: string;
 name: string;
 description: string;
 /** 主工具 id，等于 stack。 */
 stack: string;
 /** 必须恰好等于 [stack]。 */
 toolIds: string[];
 kind: DemoKind;
 /** 官方能力文档地址。 */
 documentation?: string;
}
export interface Catalog { categories:Category[]; tools:Tool[]; demos:Demo[]; updatedAt:string; }

/** 展示用类型：兼容 catalog 的真实 Demo 与历史 kind。 */
export interface DemoLike extends Omit<Demo, 'stack' | 'toolIds' | 'kind'> { toolIds: string[]; kind: DemoKind; stack?: string; }
