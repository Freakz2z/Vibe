export interface Category { id: string; name: string; description: string; icon: string; }
export interface Tool {
 id: string; name: string; tagline: string; description: string; categoryId: string;
 website: string; github?: string; install?: string; tags: string[];
 platforms: ('Web'|'Mobile'|'CLI')[]; pricing: '开源免费'|'免费使用'|'免费增值'|'付费';
 icon: string; logo?: string; logoDark?: string; accent: string; featured: boolean; demoId?: string;
 useCases: string[]; highlights: string[];
}
export interface Demo { id:string; name:string; description:string; toolIds:string[]; kind:'spring'|'chart'|'gradient'|'kanban'|'particles'|'markdown'; }
export interface Catalog { categories:Category[]; tools:Tool[]; demos:Demo[]; updatedAt:string; }
