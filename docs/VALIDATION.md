# 部署与验收记录

日期：2026-10-19（Asia/Shanghai）

## 正式部署

- 正式地址：https://vibe.freakz2z.com
- Cloudflare Worker：`vibe-cn`
- 当前部署版本：`ab089b09-9411-4df2-b908-85899a50d080`
- D1：`vibe-catalog` / `d65cc446-0b9e-47de-b937-76915cbefe68`
- R2：`vibe-assets`，通过 Worker `MEDIA` binding 读取。
- 自定义域名已在 Cloudflare 返回 `enabled: true`，服务为 `vibe-cn`、环境为 `production`。
- 公网 DNS 已解析出 Cloudflare IPv4/IPv6，HTTPS 证书正常。

## 功能范围

66 个工具、10 个中文分类、6 个交互示例。支持分类、关键词、平台和费用筛选、工具详情、安装命令复制、快捷搜索、本机收藏和浅色/深色/跟随系统主题。收藏与主题不跨设备同步。

六个示例为本站独立实现的原理演示：弹簧参数、柱线图切换、渐变 CSS、任务看板、Canvas 粒子、Markdown 安全预览。关联工具用于帮助选型，并未暗示示例在运行相应第三方库。

## 实施分工

- 前端、响应式、双主题、中文文案、66 项目录资料和示例由 Claude Code CLI 实施。
- 用户切换供应商之后，CLI 新启动及后续会话响应中 model 均为 `deepseek-flash`；会话 `d84347bf-055c-4d85-8984-36668240b923`。
- 后端、API 契约、D1 迁移、R2 接入、品牌图片和 Cloudflare 部署由 Codex 完成。
- 原有 MiniMax CLI 进程在用户切换供应商后停止，仅保留早期脚手架；后续前端与修订在 DeepSeek 会话执行。

## 已通过

- `npm run typecheck`。
- `npm test`：3 个后端边界用例（参数绑定、分页限制、媒体路径）。
- `npm run build`：Vite 8.3.4 生产构建；JS 236.07 kB / gzip 74.31 kB，CSS 76.12 kB / gzip 14.58 kB。
- `npm audit`：0 个已知漏洞。
- 构建后 Worker 的真实接口验收通过：D1/R2 健康、中文查询、筛选、分页、详情、404、HEAD、禁止公开写入、R2 ETag/304、页面元信息、站点地图与 robots。
- 同一套接口验收在正式域名通过，证据为本机 `artifacts/api-production.json`。
- 构建后 Worker 的 5 组浏览器测试通过：真实目录与全部主要路由，搜索/收藏/示例/安全 Markdown，320px，390px，暗色主题。
- 正式域名同样 5/5 浏览器测试通过（2.2 分钟），使用真实 D1/R2 接口。流程包含桌面与全部九个主要路由、搜索/筛选/收藏持久化/示例/Markdown 注入保护、320px、390px、暗色主题。日志：本机 `artifacts/e2e-production.log`。
- 正式域名 24 项接口与资源检查全部通过（2026-10-19 10:22 CST），D1/R2 均为 ready。
- 额外在线交互验证：图表成功从柱状切换折线，换成上升数据后最高值为 68；渐变参数和复制 CSS 成功。

## 网络与平台说明

本机路由器仍缓存了部署前的 NXDOMAIN，验收通过系统已经配置的 `127.0.0.1:7890` 代理进行。未改系统 DNS，未关闭 HTTPS 证书校验。公网 DNS（8.8.8.8）已能解析新域名。

首次线上浏览器验收发现 Cloudflare 自动注入脚本与 CSP 的兼容问题，已按官方 nonce 机制修复并重新部署；没有关闭域名防护或开放任意脚本。HTML 使用每次响应的新 nonce 与不缓存策略，R2 图片仍保留缓存和 ETag。

官网链接检查为 61/66 直接成功；4 个网络失败地址通过网页再次核对，Unsplash 返回机器人验证页。具体见 `docs/CURATION.md`。

## 复测

```bash
npm run typecheck
npm test
npm run build
npm audit
npm run test:api
VIBE_TEST_BASE_URL=http://localhost:8787 npm run test:e2e
```

线上全路由测试跨网络连续导航超过原先 30 秒用例上限，已将巡检时限设为 120 秒，单项可见性等待 15 秒；没有降低功能断言或忽略控制台错误。

正式环境通过普通网络访问时：

```bash
npm run test:api -- https://vibe.freakz2z.com
VIBE_TEST_BASE_URL=https://vibe.freakz2z.com npm run test:e2e
```

如果机器使用系统 HTTP 代理，但命令行没有继承代理设置，可给浏览器测试传入 `VIBE_TEST_PROXY`。Node 22.23+ 的脚本可使用 `HTTPS_PROXY` 配合 `node --use-env-proxy --import tsx scripts/verify-api.ts <正式地址>`。
