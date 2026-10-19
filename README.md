# Vibe 工具集

面向中文开发者的工具目录与交互示例站。参考 vibecodetools.dev 的分类浏览方式，采用独立中文内容与视觉设计。

目标地址：https://vibe.freakz2z.com

## 结构与职责

- `apps/web/`：React 前端、主题、响应式布局、中文文案与交互演示，由 Claude Code CLI 实现。
- `src/`：Codex 编写的 Cloudflare Workers 后端。
- `shared/contracts.ts`：前后端 API 数据契约。
- `data/catalog.json`：可维护的工具资料源，由 Claude Code CLI 编写。
- `migrations/`：D1 表结构和内容迁移。
- R2 `vibe-assets`：品牌等图片资源。通过本站 `/media/` 读取，存储桶无需公开。

## 本地启动

需要 Node.js 22.12+ 和 npm。

```bash
npm ci
npm run seed:build
npm run db:local
npm run assets:local
npm run build
npm run dev
```

访问 `http://localhost:8787`，Worker 同时提供前端、D1 与 R2。开发前端时另开终端执行 `npm run dev:web`，Vite 会代理 API 与媒体到 8787。

## 检查

```bash
npm run typecheck
npm test
npm run build
npm audit
npm run test:api
npm run test:e2e
```

端到端测试默认连接 Vite 5173 的真实 API。检查构建后 Worker 时使用 `VIBE_TEST_BASE_URL=http://localhost:8787 npm run test:e2e`，检查线上时改为正式域名。只有显式设置 `VIBE_TEST_MOCK=1` 才使用隔离数据。首次运行浏览器测试需 `npx playwright install chromium`。

## 内容更新与部署

编辑 `data/catalog.json`，更新 `updatedAt`。首次构建种子使用 `npm run seed:build`；后续修改用 `npm run seed:build -- --next` 创建新的递增迁移，脚本会阻止改写已经存在的初始迁移。分类与工具 ID 是稳定 URL，不应随意改动。

```bash
wrangler login
npm run db:remote
npm run assets:remote
npm run deploy
```

D1 数据库：`vibe-catalog`。R2：`vibe-assets`。自定义域名在 `wrangler.jsonc` 的 `routes` 中配置。只读目录无需公开写入、账号系统或上传端点。部署前检查 `/api/health`，应同时返回 D1 和 R2 `ready`。

## API

- `GET /api/catalog`：分类、全部工具、示例与内容日期。
- `GET /api/tools?q=&category=&platform=&pricing=&demo=1&featured=1&limit=60&offset=0`：绑定参数查询，最多每页 100 条。
- `GET /api/tools/:id`：工具详情，缺失返回 404。
- `GET /api/categories`、`GET /api/demos`。
- `GET /api/health`：D1/R2 就绪检查，无凭据输出。
- `GET /media/brand/logo.png`：R2 图片资源，支持 ETag。
- `GET /robots.txt`、`GET /sitemap.xml`。

收藏只保存在访客当前浏览器，无跨设备同步。交互示例是教学原理演示，具体技术归属以页面标注为准。工具能力、授权和价格以各工具官网为准。站点不抓取或虚构实时排名。

品牌素材来源和生成提示词见 `docs/ASSETS.md`。部署验证见 `docs/VALIDATION.md`。
