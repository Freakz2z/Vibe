# 内容核验记录（2026-10-19）

本项目的中文工具介绍与页面文案由 Claude Code CLI 编写。Codex 校验数据结构、关联、官方链接和显著易变信息。工具能力、授权与价格最终以官网为准；目录不宣称所有工具已逐一实测。

## 来源与处理

- 参考结构：[vibecodetools.dev](https://vibecodetools.dev/en)。本站采用独立品牌、中文介绍和示例代码。
- 66 个工具官网的自动 GET 检查：61 个直接成功；GitHub Actions、Google Fonts、markdown-it、Swiper 的脚本请求遇到网络超时或连接错误，随后通过网页读取再次确认官方地址有效。
- Unsplash 返回站点机器人验证页（401），不绕过验证；保留官方链接，不将自动检查成功数写成站内背书。
- GSAP 官方说明其所有插件现在免费；使用自有 no-charge license，不能因此标成标准开源授权。[官方 README](https://github.com/greensock/GSAP/blob/master/README.md)、[安装说明](https://gsap.com/docs/v3/Installation/)。
- SwiftUI 工具与免费开发者账号可用于开发，App Store 分发属于另外的开发者计划。[Apple 免费入门](https://developer.apple.com/get-started/)、[SwiftUI](https://developer.apple.com/swiftui/)。

完整链接检查结果保存在本机 `artifacts/link-check.json`，不部署到公开目录。

## 计费标签

- 开源免费：开源工具的基础版本；不代表其云服务、模型调用或主机资源免费。
- 免费使用：可以不付费使用，但不声称采用开源许可。
- 免费增值：存在免费基础功能和额外收费服务。
- 付费：以付费产品或订阅为主；不对价格作实时承诺。

## 后续维护

编辑 `data/catalog.json` 后执行 `npm run seed:build -- --next` 生成新迁移，不改写已经发布的迁移。运行 `npx tsx scripts/check-links.ts` 更新链接报告，人工复核失败项。不要根据一个网络请求失败就删除工具或声称官网失效。

## Cloudflare 注入脚本兼容

线上验收发现域名原有设置自动注入 Cloudflare 的 Web Analytics 与 JavaScript Detections 脚本。应用按官方说明对 HTML 使用每次请求随机生成的 CSP nonce，并仅允许 Cloudflare 官方分析脚本源。HTML 不缓存，图片继续保留缓存与 ETag；未启用脚本 unsafe-inline，也未关闭域名防护。

参考：[JavaScript Detections 与 CSP](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)、[Web Analytics CSP 要求](https://developers.cloudflare.com/web-analytics/faq/)。
