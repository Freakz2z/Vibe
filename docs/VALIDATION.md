# 验收记录

日期：2026-10-19（Asia/Shanghai）

## 本轮范围

**219 个工具、10 个分类、55 个专属示例**：50 个浏览器库与 5 个本站服务。一例一个主工具，不再用通用演示关联多个工具。全部工具首页已去掉编辑精选与示例推荐区，保留侧边栏示例入口、顶部唯一收藏入口、最右侧 GitHub 链接、官方 Logo、亮暗主题和移动筛选。

示例初稿由 Claude Code CLI / MiniMax 编写；按用户最新要求停止调用后，Codex 完成剩余前后端、交互、文案、验收与发布。

## 检查范围与证据

- 类型检查与生产构建通过；示例按库动态加载。运行资源构建前检查 SHA-256，并生成精确的媒体路径放行清单。
- 7 项后端单元测试通过：查询绑定、分页、路径限制、数值输入、字节范围、HTML 转义和弱 ETag 匹配。
- 24 项正式 API 检查通过，确认 219/10/55 数据、搜索/筛选/分页、404/405、ETag、CSP nonce、站点地图与页面元信息。
- 27 项正式服务检查通过，涵盖真实 D1、Drizzle 连接、Kysely 聚合、Hono 中间件、htmx 片段和 R2 的 HEAD/304/206/416。
- 3 个正式运行资源的实际响应通过 MIME、SHA-256、ETag 校验；未列入清单的键返回 404。
- 216 个正式 R2 Logo 逐一校验 MIME、SHA-256、ETag；Monaco Editor、Lottie Web、uPlot 的 3 个文字回退有来源说明。
- 本地浏览器套件 75 项检查通过：55 个示例的实际加载、重点示例的功能操作、全部示例的 320px 亮/暗主题、样式隔离与目录/筛选/收藏/详情/返回位置恢复。部分用例只验证 SDK 输出，不能将套件通过理解为穷尽所有控件与所有库功能。
- 重点功能检查包含 GSAP 倒放与暂停、Lottie 逐帧、D3 enter/exit、ECharts dataZoom、Recharts 区间切片、Matter.js 刚体增删、地图筛选与实际绘制、TanStack Query 缓存/去重、编辑器文档/事务、Markdown 与编译器输出。
- 额外手工浏览器验证了缓存切换不发新请求、两轮 6 个查询观察者各只有 1 次请求、503 后恢复，以及 R2 完整 PNG 与字节区间一致。
- README 四张截图来自当前界面；图片引用审计通过。当前源码扫描未发现匹配常见令牌与私钥格式的内容，日志、本地状态和密钥文件不进入公开源码。

运行依赖审计为 **0 critical / 0 high / 0 moderate / 1 low**。剩余 low 为 Quill 2.0.3 的 HTML 导出路径；示例使用 Delta，不调用 `getSemanticHTML()`。详见 [示例实现记录](EXAMPLES_MINIMAX_REPORT.md)与[依赖清单](DEPENDENCIES.md)。

## 发布

- 正式站点：[vibe.freakz2z.com](https://vibe.freakz2z.com)
- 开源仓库：[Freakz2z/Vibe](https://github.com/Freakz2z/Vibe)
- CI：[Checks](https://github.com/Freakz2z/Vibe/actions/workflows/ci.yml)，只做本地初始化与验证，不自动部署。
- Worker `vibe-cn`；正式 D1 已应用至 `0013_catalog_update.sql`；运行资源与图标保存在 R2 `vibe-assets`。

Cloudflare 对压缩资源可能返回弱 ETag，媒体路由按 GET/HEAD 的弱比较规则处理条件请求。正式域名已有的 Cloudflare 分析脚本在网络检查中只按确切来源和脚本路径识别；示例 SDK 与资源均由本站提供。

完整命令输出、浏览器截图与网络证据保存在本机 `artifacts/` 和被忽略的 QA 输出目录；公开仓库保留测试脚本和素材来源。
