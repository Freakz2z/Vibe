export interface Category { id: string; name: string; description: string; icon: string; }
export interface Tool {
 id: string; name: string; tagline: string; description: string; categoryId: string;
 website: string; github?: string; source?: string; install?: string; tags: string[];
 platforms: ('Web'|'Mobile'|'CLI')[]; pricing: '开源免费'|'免费使用'|'免费增值'|'付费';
 icon: string; logo?: string; logoDark?: string; logoOnDark?:boolean; accent: string; featured: boolean; demoId?: string;
 useCases: string[]; highlights: string[];
}
export const DEMO_KINDS = ['spring','chart','gradient','kanban','particles','markdown','contrast','bezier','grid','shadow','typography','regex','json','csv','svgpath','image','flex','noise','sorting','debounce','cache'] as const;
export type DemoKind = typeof DEMO_KINDS[number];
export interface Demo { id:string; name:string; description:string; toolIds:string[]; kind:DemoKind; }
export interface Catalog { categories:Category[]; tools:Tool[]; demos:Demo[]; updatedAt:string; }
