# 参与贡献

欢迎修正文案、链接、官方 Logo，或增加工具与可交互示例。

## 开发

先按 [README](README.md#快速开始) 初始化本地 D1/R2，再运行 `npm run dev`。前端开发可另开终端运行 `npm run dev:web`，在 5173 访问。

提交前运行：

```sh
npm run seed:build
npm run typecheck
npm test
npm run build
npm run test:api
npm run test:e2e
```

## 收录工具

- 在 `data/catalog.json` 中维护工具。ID 是公开 URL，已发布 ID 不应随意修改。
- 填写具体功能、实际适用场景、官网和当前源码入口。不能用同一套空泛句子填充多个条目。
- `pricing` 是费用模式，不是许可证结论；免费软件与其付费托管、增值服务应分别说明。
- 核对官网、源码迁移和维护情况，不编造亲测、排名、价格或性能数据。
- Logo 从官方来源获取，记录在 `assets/icons/sources.json`，通过本站 R2 提供。不要使用不明来源的 Logo 聚合服务，也不要为第三方品牌生成仿制图标。
- 数据确认后执行 `npm run seed:build -- --next` 新建迁移，保留已发布迁移。

## 新增示例

示例需要有真实可操作的输入和输出，展示一种清楚的能力。请同时更新 DemoKind、渲染入口、缩略图、标签、目录关联与回归测试。

默认不联网处理访客输入，不执行不可信代码。长计算应限制规模或放在可终止的 Worker 中。支持键盘、亮暗主题、320px 屏幕和减少动态效果；禁止 hover 导致卡片或按钮位移。

## Pull Request

说明解决的问题、用户可观察的变化和实际验证结果。界面改动请附桌面与手机截图。不要提交本地数据库、Cookie、Token、`.env`、`.wrangler`、日志或依赖目录。
