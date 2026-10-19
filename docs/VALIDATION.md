# 验收记录

日期：2026-10-19（Asia/Shanghai）

## 本轮范围

当前源码包含 **219 个工具、10 个分类、21 个可交互示例**。新增 153 个工具与 15 个示例由维护代理直接完成，未调用 Claude CLI。保留暖色卡片、亮暗主题、移动端筛选、唯一全站收藏入口与无 hover 位移规则。

217 个工具使用有来源和 SHA-256 记录的官方素材；Monaco Editor 与 Lottie Web 使用文本回退。React Three Fiber、Drei 已排除文档站默认打印机图标，改用官方仓库素材。白色标志使用深色底板，自适应 SVG 指定正确的 color-scheme。

## 本地已验证

- `npm run seed:build`：219 个工具、21 个示例，检查 ID、关联与示例类型。
- `npm run typecheck`、`npm run build`：通过；新增实验按文件组动态加载，正则拥有独立 Worker 产物。
- `npm test`：7 个用例通过，涵盖查询绑定、分页、媒体路径、对比度公式、CSV 引号与换行、排序过程及可复现噪声。
- 真实 D1/R2 的浏览器回归 **20/20 通过**，包含原功能、全部 21 个示例在桌面与 320px 的访问，以及实际的颜色、布局、曲线、数据、图片、排序、事件与缓存交互。
- 正则的复杂表达式超时会终止计算线程，之后仍能输入并匹配新规则。JSON/Markdown 的不可信文本没有作为 HTML 执行。
- 图片示例只处理当前浏览器选择的文件，不发送上传请求。输出 MIME 与下载扩展名一致。
- `verify-logos.ts`：217 个 R2 图像逐一核对 MIME、SHA-256、ETag，2 个文字回退有记录。
- `verify-api.ts`：24 项接口与资源检查通过；健康、搜索、筛选、分页、404、只读限制、ETag、HTML CSP 与元信息均正常，站点地图包含工具和示例。
- README 图片引用审计通过；正式界面截图位于 `docs/screenshots/`。
- 开源前扫描了 Git 历史与待发布源码，未发现匹配常见令牌与私钥格式的内容。本地状态、日志、密钥文件和内部任务简报不进入当前公开源码树。

## 运行与发布

- 正式站点：<https://vibe.freakz2z.com>
- Worker：`vibe-cn`，D1：`vibe-catalog`，R2：`vibe-assets`。
- 自定义部署使用 `wrangler.example.jsonc`，生产域名从 `PUBLIC_ORIGIN` 配置读取。
- GitHub Actions 只做本地检查，不执行远程部署。

生产发布版本、正式域名复测结果和 GitHub CI 结果在发布完成后记录于本节。

本机网络验收通过已有系统代理进行，未修改系统 DNS，也未关闭 TLS 验证。正式 HTML 使用每次响应新生成的 CSP nonce 兼容 Cloudflare 注入脚本；媒体保持缓存与 ETag，缺失媒体不缓存。
