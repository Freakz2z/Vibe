# 本地开发与维护

[返回项目首页](../README.md) · [部署说明](DEPLOYMENT.md)

## 快速开始

需要 **Node.js 22.12+、npm**。本地开发使用模拟的 D1/R2，不需要 Cloudflare 账号。

```sh
git clone https://github.com/Freakz2z/Vibe.git
cd Vibe
npm ci
cp wrangler.example.jsonc wrangler.jsonc
npm run db:local
npm run assets:local
npm run assets:demos:local
npm run build
npm run dev
```

打开 **http://localhost:8787**。页面、工具 API 和本地素材都由同一个 Worker 提供。退出时在运行终端按 `Ctrl+C`。

修改前端时，保持 Worker 运行，另开终端执行：

```sh
npm run dev:web
```

访问 **http://127.0.0.1:5173**，Vite 会把 `/api` 和 `/media` 请求转发到本地 Worker。

<details>
<summary>告诉 Agent 如何启动和验证 Vibe</summary>

将下面这段话复制给能联网、读文件和执行终端命令的 Agent：

```text
请帮我在本地运行 Vibe 工具集：
https://github.com/Freakz2z/Vibe

先读取 README 和 AGENTS.md，检查 Node.js 与 npm。
在独立目录克隆仓库，使用 wrangler.example.jsonc 创建本地配置。
初始化本地 D1 和 R2，构建并运行 Worker。
验证 /api/health、工具目录、全部示例及一个实际交互，告诉我地址与退出方式。
本次只运行本地环境，不创建远程资源、不部署、不修改线上数据。
不要读取或输出我的 Cloudflare Token、Cookie 或其他密钥。
```

</details>

## 维护工具与示例

- [贡献指南](../CONTRIBUTING.md)：内容字段、官方来源、Logo、示例实现和验证要求。
- [素材来源](ASSETS.md) / [官方 Logo 清单](../assets/icons/sources.json)：图像出处与 SHA-256。
- [收录核对](CURATION.md)：来源、费用标签和已知访问限制。
- [第三方声明](../THIRD_PARTY_NOTICES.md)：品牌、依赖和示例的许可边界。
- [验收记录](VALIDATION.md)：实际检查与部署结果。

目录源为 `data/catalog.json`。更新数据后执行 `npm run seed:build -- --next` 创建新迁移，再应用到目标 D1。已发布迁移和稳定工具 ID 应保留。

<details>
<summary>目录结构与检查命令</summary>

```text
apps/web/       React 页面、主题与交互示例
src/            Workers 后端与媒体路由
shared/         API 数据契约
migrations/     D1 表结构与内容迁移
assets/icons/   官方工具图标与来源清单
scripts/        数据生成、素材同步与验收脚本
```

```sh
npm run seed:build
npm run typecheck
npm test
npm run build
npm run test:api
npm run test:labs
npm run test:demo-assets
node --import tsx scripts/verify-logos.ts
npx playwright install chromium
npm run test:e2e
```

接口与浏览器测试需要本地 Worker 已启动。GitHub Actions 执行本地初始化和检查，不自动部署生产站点。

</details>
