# 内容核验记录（2026-10-19）

本项目以独立中文介绍记录工具用途，核对数据结构、关联、官方链接和显著易变信息。工具能力、授权与价格最终以官网为准；目录不宣称所有工具已逐一实测。

## 来源与处理

- 目录现有 219 个工具。本站示例已按“一例一个主要技术栈”重新组织，实际加载对应库或请求本站真实服务；不能在本站真实运行的工具不关联示例。
- 示例初稿由用户指定的 Claude Code CLI / MiniMax-M3.1-Flash-Preview 编写；额度用尽后按用户要求停止调用，由 Codex 接手后端、前端修正、文案、验收与发布。具体实现与验收见 [示例报告](EXAMPLES_MINIMAX_REPORT.md)。
- 本轮源码核对记录见 [catalog-sources.json](catalog-sources.json)，包括官方仓库、主页、许可标识与归档状态。许可元数据仅作核对线索，不将 NOASSERTION 等同于开源许可。
- 候选中的 Roo Code、Flowise、TOAST UI Editor 已归档，本轮未加入目录，改用 Kilo Code、Mastra、Plate。
- CodeMirror 与 ProseMirror 的 GitHub 镜像已归档，但官方 README 明确指向新的独立托管站。详情使用迁移后的源码入口，而非把 GitHub 归档理解为项目停用。[CodeMirror](https://github.com/codemirror/view)、[ProseMirror](https://github.com/ProseMirror/prosemirror-state)。
- 官网 GET 检查保留响应状态、标题和重定向。超时、限流或机器人验证不会被包装成官网失效或实测成功。Unsplash 的验证页、Observable 的限流均未绕过。
- Logo 逐项与官方来源核对，216 个可用素材由本站 R2 提供；Monaco Editor、Lottie Web 与 uPlot 使用文本回退。部分白色或自适应标志使用相应底板与 color-scheme，不使用滤镜伪造品牌色。
- 站点不提供工具的实时排名、star、版本或价格承诺。示例交互只说明页面中实际运行的能力，不宣称涵盖工具所有功能。

完整自动检查结果保存在本机 `artifacts/`，公开仓库保留可复核的来源清单。历史 66 个工具的初始文案曾由 Claude CLI 编写；后续维护按当前用户要求由维护代理直接完成。

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
