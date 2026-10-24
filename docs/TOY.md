# Vibe 工具集 · Toy 手机版

状态：2026-10-24 已生成预览，**未提交审核，未发布为正式 Toy**。

- 标题：Vibe 工具集
- 预定 slug：`vibe-tools-mobile`（正式提交前仍可调整，发布后不可修改）
- 验收预览：https://www.bilibili.com/toy/preview/author_85Sf8Q8Y/index.html
- 原站：https://vibe.freakz2z.com/

## 构建与预览

```sh
npm run build:toy
npm run preview:toy
```

产物 `dist-toy/`；本机模拟真实子路径为 `http://127.0.0.1:4178/toy/vibe-tools-mobile/index.html`，不会把不存在的 history 路由静默兜底为首页。

同一份 React/Vite 源码在 `toy` 模式下使用独立入口、相对资源路径、Hash 导航和手机样式。普通网站仍保留原有入口、路由、页面结构和 R2 资源方式。

## 内容与网络边界

219 个工具、10 个分类、55 个真实示例的目录快照来自 `data/catalog.json`。首页、搜索和筛选无需请求目录 API。内容更新后需要重新构建和上传 Toy。

官方 Logo、地图数据、esbuild WASM 和示例依赖随包分发；示例仍按单个库懒加载。包内 `sources/` 保留 Logo 来源和运行资源清单，数据复制前核对 SHA-256。Toy 预览曾对 `.geojson` 和 `.mjs` 返回 404，因此只在 Toy 构建中分别输出为 `.json`、`.js`；原站地址不变。

8 个示例使用真实只读服务：D1、Drizzle、Kysely、Hono、R2、HTMX、SWR、TanStack Query。它们请求 `https://vibe.freakz2z.com/api/toy/labs/*`，仍依赖原站跨境线路；没有模拟接口或伪造结果。

CORS 来源精确匹配 `https://www.bilibili.com` 和预览实际内容容器 `https://www.bilibilitoy.com`。只允许 GET/HEAD 和受约束的 OPTIONS，不开放凭据与写操作；R2 暴露 ETag/Range 等读取证据。原站访客统计的 Origin 校验保持不变，Toy 页面不调用原站访问统计，也不把平台 PV/UV冒充为原站访客数。

## 手机交互

- 首页、分类、示例、收藏四个底部导航；收藏是唯一全局收藏入口。
- 单列卡片、独立分类页、搜索框；平台/费用在底部面板中暂存，点击应用才提交，关闭即取消。
- 详情完整阅读、复制命令；返回保留条件和列表位置。
- 示例使用单层边距，画布优先展示；参数集中到可滚动居中面板，右上角「完成」关闭，支持焦点约束、Esc 关闭和返回触发按钮。代码独立折叠，统计卡片按数值与文本排布。
- Markdown、Mermaid、KaTeX 等源码保持直接编辑，富文本格式工具栏常驻；长代码横向滚动，宽屏输入与输出并排。表格局部滚动，图表、地图、编辑器和大依赖按需加载。
- G6 手机端默认网格布局，支持切换力导向、分层布局；选中节点资料保留在画布下方。
- 浅色默认，可切换暗色/跟随系统；触控区域、减少动态效果、安全区及键盘遮挡适配。
- 收藏、主题与滚动位置使用 Toy 专用本地键，不会自动迁移原站收藏；未接入云存储或用户资料。

Toy SDK 的分享、二维码和容器能力先调用 `isSupport`。分享通过 Toy 内 `index.html?tool=...` / `?demo=...` 路径直达；Web 环境无法拉起端内分享时尝试复制 B站包装页链接。容器切换以状态通知确认，Promise 返回不视为成功；离开示例时恢复本次请求的横屏沉浸模式。

## 验收边界

本地构建、类型检查与 24 项后端测试通过；原站真实 API、27 项服务检查和 20 项桌面/手机浏览器回归通过。Toy 子路径下验证了目录、分类、筛选草稿/取消/应用、收藏持久化、返回、分享参数直达及 320/390/768/1280 宽度。

B站真实预览中已验证 HTMX 搜索片段及 Toy 内链接、R2 206 分段读取、Leaflet 177 个边界、MapLibre 地图绘制、esbuild WASM 编译。本次布局检查覆盖全部 55 个示例，截图与几何尺寸记录保存于本机 `artifacts/toy-layout-before/`、`artifacts/toy-layout-after/` 和 `artifacts/toy-audit-after-*.log`。参数调整、GSAP 播放、Markdown 实时解析、Tiptap 加粗等真实交互记录于 `artifacts/toy-layout-interactions.log`；最终预览的关系图布局切换、R2 完整读取与 206、320/390 手机及横屏/桌面参数面板检查记录于 `artifacts/toy-layout-final-actions.log`；最终预览全量加载与 320/390/768/1280 宽度、亮暗模式检查记录于 `artifacts/toy-layout-final-smoke.log`、`artifacts/toy-layout-final-responsive.log`。

**手机尺寸浏览器检查不等于实体手机 App 验收。** iOS/Android B站 App 的安全区、软键盘、触摸拖拽、端内分享和横屏沉浸仍需用户在预览中验收。预览环境不支持的 SDK 能力不能冒充已验证成功。

## 上传与审核

先按 Toy 技能执行内容检查，再仅生成预览：

```sh
toy create dist-toy --title 'Vibe 工具集' --slug vibe-tools-mobile --poster apps/web/public/brand/og.png --visibility public --json
```

本次未使用 `--yes`。预览上传不等于审核提交；用户验收并明确确认提交后，才按相同目标与参数提交审核。正式提交前重查本机发布记录和线上列表，避免重复创建；已有 Toy 后更新必须保留其 slug。当前封面使用已有品牌图，内容检查只有非阻塞的 4:3 比例建议。
