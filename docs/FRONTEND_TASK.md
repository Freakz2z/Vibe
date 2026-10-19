# Claude Code 前端与中文文案任务
你负责本项目全部前端与中文文案，Codex负责后端、存储、部署和品牌图像。当前目录 /Users/freakk/WorkSpace/Project/Vibe。不要调用子代理。只允许修改 apps/web/** 和 data/catalog.json。不要修改 shared/contracts.ts、后端、根 package.json、wrangler、scripts、migrations、docs。

## 产品
模仿 https://vibecodetools.dev/en 的分类导航工具目录逻辑，制作精致原创中文工具导航「Vibe 工具集」。中文为主，用户是独立开发者与使用AI编程的创造者。参考站是左侧多级分类、顶部搜索、平台筛选、分区工具卡、安装命令复制。不要照搬品牌和英文文案。做成真正能浏览、查找、收藏、站内体验效果的网站。可读共享 shared/contracts.ts。

## 技术
apps/web 用 React + TypeScript + Vite。可以 lucide-react 做功能图标。自行创建 package.json (scripts dev: vite --host 127.0.0.1, build: tsc -b && vite build, typecheck: tsc --noEmit 或等价), vite.config.ts、index.html、tsconfig。dev代理 /api、/media 到 http://127.0.0.1:8787。root npm install 由 Codex 完成；你可以需要时运行 npm install。输出 build dist 到 apps/web/dist。不要创建假API或在UI中导入catalog.json兜底。只从 GET /api/catalog 返回 Catalog 取得全部数据。GET /api/tools/:id 也可取单个，搜索可以直接客户端响应（后端也支持 /api/tools?q=&category=&platform=&pricing=&demo=1）。logo URL 用 /media/brand/logo.png，可同时提供 /brand/logo.png fallback。后续由 Codex 提供该文件，不用等图像。社交预览 /media/brand/og.png。

## 设计
高品质克制工具目录，温暖浅色、深墨色暗色、珊瑚橙强调，清晰中文排版。桌面固定左侧栏（大约240px）、轻量顶栏搜索、内容宽阔；手机抽屉导航、易点按、无横向溢出。首页要有醒目但紧凑的主标题、介绍、小型精选区、可直接点开的交互示例，以及实用密集的工具列表。不是大幅营销落地页。支持浅/深/跟随系统模式，并持久化；系统变化也响应。分类、搜索、平台和开源筛选、收藏（明确保存在本机，无须账号）、详情（独立URL /tools/:id 或hash路由）、站内示例、关于/选型说明（可弹窗）均真实可用。URL保留搜索/分类便于分享。⌘K 搜索弹窗、Esc关闭、空结果、加载与API错误重试、复制成功/失败反馈。详情包括官方链接、用法、适用场景和真实亮点，无编造stars和热度，不声称亲测所有工具。点击外链另开并 rel noopener noreferrer。避免订阅/提交等无后端的假按钮。不要增加投稿表单。

## 站内可视化（重点）
至少6个可交互示例，对应kind：spring 弹簧参数拖动、chart 柱线切换/数据变化、gradient 可调颜色和角度/复制CSS、kanban 跨列拖拽且手机有移动按钮、particles 粒子密度/吸引交互 Canvas、markdown 实时编辑预览（绝不能直接渲染不可信HTML，使用安全纯文本解析或禁用HTML的库）。可用真实对应库，也可技术原理演示，但必须诚实标「原理演示」且别冒充该库运行。demo名字与数据匹配、可从卡片/详情进入；动画尊重 prefers-reduced-motion，Canvas清理和可见性，图表可访问标签。内容页不用横幅占太多空间。

## 中文内容数据（由你撰写）
写 data/catalog.json 严格符合 Catalog。至少48个真正存在的工具、10个分类、6个 demos。分类覆盖AI编程/前端UI/动画交互/图表数据/后端数据库/工程部署/移动开发/设计资源/内容编辑/效率工具。工具中应含 React,Vite,Vue,Next.js,Tailwind CSS,shadcn/ui,Motion,GSAP,Three.js,ECharts,D3,Chart.js,Cloudflare Workers,D1,R2,Hono,Drizzle,Prisma,SQLite,Redis,Expo,Flutter,SwiftUI,Tiptap,Lexical,Monaco,Swiper,dnd-kit,Lucide,Iconify,Radix UI,Zod,TanStack Query,Zustand,Playwright,Vitest,Biome,TypeScript,Claude Code,Cursor,Continue,Ollama,Vercel AI SDK,LangGraph。每个都要简练原创中文tagline/description/useCases/highlights，真实官方website/github（不确定宁可不用github）。icon 字段使用简短字符或稳定类型标识，accent 用hex。没有实时抓取数据就不要写更新数/排行榜。pricing 只写稳定基本模式且关于声明以官网为准。demoId 可按对应示例赋给关联工具。updatedAt 用2026-10-19。可为精选挑8个。

## 验收
写完自行检视类型、移动端逻辑、可访问性，修复后报告新增文件、功能、内容数和已知限制。所有用户可见文案由你编写。你有权限编辑限定文件范围内代码，直接完成，不要只给计划。
