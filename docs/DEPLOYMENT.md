# 自行部署

[返回项目首页](../README.md) · [本地开发](DEVELOPMENT.md)

## 自行部署

需要 Cloudflare 账号，并启用 Workers、D1 和 R2。使用自己的资源，不要沿用本仓库的生产账号配置。

```sh
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler login
npx wrangler d1 create vibe-catalog
npx wrangler r2 bucket create vibe-assets
```

将 D1 创建结果中的 `database_id` 填进 `wrangler.jsonc`。如果修改数据库或存储桶名称，同步修改对应 binding 的资源名称和脚本参数。

部署时将 `vars.PUBLIC_ORIGIN` 设置为自己的 HTTPS 地址，并配置自定义域名：

```jsonc
"vars": { "PUBLIC_ORIGIN": "https://tools.example.com" },
"routes": [ { "pattern": "tools.example.com", "custom_domain": true } ]
```

域名需要在当前 Cloudflare 账号中管理。也可先使用 Workers 提供的 `workers.dev` 域名，并将 `PUBLIC_ORIGIN` 设置为该地址。

```sh
npm run db:remote
npm run assets:remote
npm run assets:demos:remote
npm run deploy
```

发布后检查 `/api/health`，应返回 `status: "ok"`、`database: "ready"` 与 `storage: "ready"`。API 与浏览器检查可切换到自己的地址：

```sh
node --import tsx scripts/verify-api.ts https://tools.example.com
node --import tsx scripts/verify-logos.ts https://tools.example.com
VIBE_TEST_BASE_URL=https://tools.example.com npm run test:e2e
```

Remote 命令会访问真实 Cloudflare 资源；本地测试不会自动执行部署。站点没有公开写入、文件上传、账号或管理接口。R2 存储桶不需要设为公开，通过 Worker 的 `/media/` 路由读取。
