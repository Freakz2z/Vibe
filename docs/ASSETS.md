# 品牌素材

品牌图像由 Codex 使用内置 imagegen 生成，2026-10-19。

- 网站图标：`apps/web/public/brand/logo.png`（256px，原图等比缩小）
- 社交分享图：`apps/web/public/brand/og.png`（原始图）
- 原始分享图：`apps/web/public/brand/og.png`
- R2 对象键：`brand/logo.png`、`brand/og.png`
- 公开读取：`/media/brand/logo.png`、`/media/brand/og.png`

生成提示词：

> Use case: logo-brand. Create a single polished app icon for a Chinese developer tool directory named Vibe. No words or lettering. Square 1024x1024 design. A bold distinctive flowing V-shaped folded ribbon, in warm coral orange (#F26B4F) with subtle terracotta shading, sits centered on an ivory (#FAF8F5) background, large enough to read at 24 pixels. Precise clean silhouette, slightly rounded ribbon corners, a small sense of depth but largely flat vector-like illustration, premium editorial software identity. The ribbon has two short tails rising upward and a deep angular V bottom, suggesting code brackets and creative momentum. Generous consistent padding. No gradients in background, no shadows cast beyond icon, no extraneous objects, no text, no watermark. This is a finished production website favicon/logo.

不使用第三方工具的商标图作为站点自身品牌。功能图标使用 Lucide。

## 工具官方 Logo（2026-10-19）

`assets/icons/sources.json` 记录每个工具的官网、官方素材 URL、最终 URL、MIME、大小、SHA-256 与取得时间；图像原文件保存在同目录。素材只用于识别相应工具，商标权属于原权利人，不代表合作或背书。

- 216 个工具从官网 favicon、官网品牌资源或官方 GitHub 仓库/组织取得图标；保留原始图像字节，不通过第三方 Logo 聚合站热链。
- Cloudflare Workers、D1、R2 使用 Cloudflare 文档官方仓库中的独立服务图标；SwiftUI 使用 Apple 官方产品图标。
- Monaco Editor、Lottie Web 与 uPlot 未找到可确认、适合单独使用的产品标志，当前保留文字缩写，不用 Microsoft 公司标志替代。
- 资源以 `icons/*` 键上传 R2，目录数据的 `logo` 字段引用 `/media/icons/*`。前端统一处理亮暗主题和加载失败回退。
- `node --use-env-proxy scripts/fetch-official-logos.mjs [tool-id ...]` 从官方来源取得素材，源记录可审查后发布；该脚本不会自动改动线上数据。
- `npm run assets:local -- --prefix=icons` / `npm run assets:remote -- --prefix=icons` 同步图标。
- `node --import tsx scripts/verify-logos.ts [站点地址]` 将真实 API 中所有图标与源文件校验和逐一比对。

## 示例运行资源

`assets/demos/manifest.json` 记录独立运行资源的本站键、源文件、MIME、SHA-256、官方来源和许可。构建前逐项检查哈希，后端只放行清单中的键。

- 地图使用 Natural Earth 的国家边界 GeoJSON，快照保留原始几何，并提取、重命名名称、洲、人口估计、ISO 四个属性；中文名称来自源属性，加载时另生成内部唯一 ID。快照不是实时人口或实时边界服务。原始源链接在清单中；许可依据为 [Natural Earth 使用条款](https://www.naturalearthdata.com/about/terms-of-use/)。
- esbuild-wasm 的编译器二进制来自锁定的 npm 发布包，按 MIT 许可使用；页面只编译并展示结果，不执行访客代码。
- `npm run assets:demos:local` / `npm run assets:demos:remote` 同步资源至目标 R2。
- `npm run test:demo-assets -- [站点地址]` 对实际响应的 MIME、SHA-256、ETag 与未放行键进行检查。
