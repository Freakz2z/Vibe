# 阿里云 ESA 免费版接入与回退

更新：2026-10-20。**正式域名已切换到 ESA 免费版**；测试域名保留。freakz2z.com 尚未 ICP 备案，本次选择“全球（不包含中国内地）”，实际样本命中香港节点，不能称为中国大陆节点加速。

## 当前配置

| 项目 | 配置 |
| --- | --- |
| ESA 站点 | freakz2z.com，站点 ID `184586157250796`，CNAME 接入 |
| 套餐 | 已有免费版资源；本次未购买付费套餐，自动续费关闭 |
| 测试入口 | https://vibe-cdn-test.freakz2z.com/ |
| 正式 ESA CNAME | `vibe.freakz2z.com.a1.initxx.com`，Cloudflare DNS only |
| 测试 ESA CNAME | `vibe-cdn-test.freakz2z.com.a1.initxx.com`，Cloudflare DNS only |
| 回源 | `vibe-origin.freakz2z.com`，同一个 Cloudflare Worker |
| 回源协议 | HTTPS 443，Host 跟随源站域名，SNI 跟随 Host |
| 证书 | 正式域名与测试域名分别使用 Let's Encrypt，TLS 验证通过；DCV CNAME 保留用于续签 |
| 正式入口 | https://vibe.freakz2z.com/ → ESA → HTTPS 专用源站 → Cloudflare Worker |

Workers、D1 和 R2 保留。新增 `_esaauth` 所有权校验 TXT、正式及测试域名 CNAME、对应证书托管 DCV CNAME，以及独立回源域名；没有修改根域、www 或其他服务的解析。

ESA 的 `Vibe-CDN-origin-headers` 仅匹配正式和测试域名，以动态 `http.host` 创建并覆盖 `X-Vibe-Forwarded-Host`，同时固定回源 `Accept-Encoding: identity`。`Vibe-CDN-HTTPS-origin` 对这两个域名强制 HTTPS 443 回源。

Worker 仅在专用回源域名上识别白名单 `X-Vibe-Forwarded-Host`；测试和直接回源页面带 `noindex`，canonical 继续指向正式站。访问统计允许测试域名的同源 POST，保留来源和请求体校验。

## 验证结果

- 生产构建、类型检查、20 项后端单测通过。
- 正式站和测试站各 20 项桌面/移动浏览器检查通过。
- 测试站目录 API、27 项真实服务检查、3 项真实运行资源哈希与条件请求检查通过；D1/R2 ready，219 个工具、55 个示例。
- Logo 和入口 JS 实际出现 ESA `X-Site-Cache-Status: HIT` / `Age`；HTML 保持 `private, no-store`，两次响应 CSP nonce 不同。
- **压缩协商已修复**：将 ESA 回源的 `Accept-Encoding` 固定为 `identity`，在边缘开启 Gzip/Brotli 并按客户端能力压缩，关闭 Zstd。测试目录旧缓存已直接清理，控制台刷新记录完成 100%。压缩后的入口 JS 解码内容与本地构建 SHA-256 一致。
- **测试地址跳转已修复**：使用“添加”操作创建并覆盖 `X-Vibe-Forwarded-Host`；`/tools/react/` 保持跳转到测试域名下的无斜杠路径。
- 已开启强制 HTTPS；HTTP 请求实际返回 301，Location 保留测试域名及原路径。
- 已开启 HTTP/2 及 HTTP/2 回源，保留 HTTPS 443 与有效源站证书。
- 停用 ESA“自适应性能优化”额外页面采集。该功能会在错误页面注入 `rum_common.js` 并触发本站 CSP 拦截。保留本站 CSP；19 项浏览器用例通过后，受影响的目录/错误页用例单独复测通过。未关闭安全防护。
- 压缩协商专项脚本：`npm run test:cdn`，24 项检查已通过。对相同 JS/CSS 缓存键交替发送现代编码、identity、gzip、br 请求，检查协商、解码后的内容哈希、实际 ESA HIT，以及 HTTPS/斜杠跳转、CSP nonce 和统计 Origin 校验。脚本使用原始响应字节，避免 fetch 自动解码掩盖问题。默认直连；需要独立检验功能时可用 `VIBE_TEST_PROXY` 显式指定代理，报告会记录传输模式。

## 当前网络测速

同一台机器直连，curl 明确禁用代理，两个入口每种路径各 7 次，单请求 20 秒超时，分别创建连接。Cloudflare 样本为 LAX，ESA 样本为香港。只有一个网络样本，不代表全国三网或晚高峰表现。

| 内容 | Cloudflare 完整下载成功 | ESA 完整下载成功 | Cloudflare 成功样本下载中位数 | ESA 成功样本下载中位数 |
| --- | --- | --- | --- | --- |
| 首页 HTML 文档 | 7/7 | 7/7 | 9.247 秒 | 1.141 秒 |
| Logo PNG | 3/7 | 7/7 | 3.279 秒 | 1.568 秒 |
| 入口 JS | 3/7 | 7/7 | 11.384 秒 | 1.271 秒 |

这是修复压缩与协议配置后的第二轮测试。首页数字仅是 HTML 文档下载，不是浏览器完整首屏时间；中位数只包含完整成功样本，失败次数单列。原始记录保存在本机忽略目录 `artifacts/cdn-fixed-benchmark.json`；第一轮记录 `artifacts/cdn-benchmark.json` 保留，不能把第一轮 JS 解码失败的耗时当成成功下载。

以上是切换前的测试域名样本，不能证明全国三网均有相同收益。用户确认后已切换正式域名。

## 缓存边界

| 路径 | CDN 策略 |
| --- | --- |
| `/assets/*` 内容哈希文件 | 尊重源站一年 immutable；必须正确处理压缩协商 |
| `/media/*` 普通 Logo | 尊重源站一小时缓存 |
| `/media/demos/*` 内容哈希资源 | 尊重源站长期缓存，保留 Range 与条件请求 |
| `/api/catalog`、`/sitemap.xml` | 尊重源站 60 秒缓存和 ETag |
| HTML | private/no-store，不能使用“缓存全部”模板，CSP nonce 每次生成 |
| `/api/visitors`、`/api/labs/*`、`/api/health` | no-store，保留 POST、条件和范围请求语义 |

没有启用忽略源站缓存头、全部缓存 30 天的自动模板。缓存命中要看 ESA 的缓存头，不能把源站 `X-Vibe-Cache` 或 `CF-Cache-Status` 当成 ESA 命中证明。

## 正式切换记录与回退

2026-10-20 用户确认“切换正式站”后：

1. 先创建正式 ESA 记录、签发正式证书并配置 DCV。保持原 DNS 不动，使用 curl `--connect-to` 向 ESA 发送正式 Host/SNI 请求，证书校验、首页 canonical、无 noindex、斜杠跳转及 D1/R2 健康检查通过。
2. `wrangler.jsonc` 仅保留 `vibe-origin.freakz2z.com` 自定义域名，使用 `wrangler triggers deploy` 解除原正式域名绑定。没有重建数据库、存储桶或 Worker 版本。
3. 在 Cloudflare DNS 添加正式域名 CNAME → `vibe.freakz2z.com.a1.initxx.com`，DNS only。权威 DNS 与 ESA 控制台均确认已配置。
4. 正式域名 API、20 项桌面/移动浏览器检查、27 项真实服务检查、3 项运行资源哈希/条件请求校验通过；真实 Edge 页面已打开，页脚统计可用。
5. 正式站 24 项 CDN 协商、哈希、缓存、跳转、CSP nonce、索引和统计来源检查经显式代理通过，记录为 `artifacts/cdn-compatibility-production.json`，包含传输模式。这用于验证功能，不作为国内直连速度的证据。直连专项检查曾因连接/传输超时中断，原日志保留。

**保留的回退配置：** Git 提交 `a1d736d` 中的 `wrangler.jsonc` 保留原正式域名与源站两个 Worker 自定义域名。需要回退时，在项目根目录恢复该文件并重新应用触发器：

```sh
git show a1d736d:wrangler.jsonc > wrangler.jsonc
npx wrangler triggers deploy
```

此操作会恢复 Cloudflare 管理的正式域名 DNS 和 Worker 绑定；先确认 CLI 的变更目标只有 `vibe.freakz2z.com` / `vibe-origin.freakz2z.com`，不要改动其他服务。回退后再核对 HTTPS、API、页面与权威 DNS；ESA 配置和 DCV 可保留，不会因保留配置产生本次套餐外费用。之后应同步提交回退后的配置，防止下一次部署重新改变绑定。

## 切换后的网络差异

切换后直接访问正式域名的额外 5 轮样本保存在 `artifacts/cdn-live-benchmark.json`。正式域名首页 HTML 完整下载 5/5，中位数 15.948 秒；测试域名为 5/5、1.116 秒。两者均到 ESA 香港节点，不能把测试域名的 1 秒结果直接当成正式站效果。

分阶段计时显示额外时间主要在 TCP 建连，源站处理仍约几十至几百毫秒。相同 IP、正式与测试域名交替探测中，当前网络到 `163.181.78.170` 均连接超时，其余三个被测地址均成功。原始记录在 `artifacts/cdn-node-probes.json`。这说明当前网络到部分 ESA 地址有可达性差异，不能宣称所有国内线路都已提速。没有将 DNS 固定到某个边缘 IP，也没有绕过 TLS 校验。

切换初期的 API/运行资源连接超时在复测通过后仍保留原日志，不将其归为功能检查成功。建议结合实际访客网络和晚高峰体验判断是否保留；出现持续不可用时按上方配置回退。

官方文档：[免费版](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/free-plan)、[套餐能力比较](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/package-function-comparison)、[接入地域与备案](https://help.aliyun.com/zh/edge-security-acceleration/esa/getting-started/add-your-website-to-esa)、[回源 SNI](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/back-to-source-sni/)。

回源请求头语义参见[官方说明](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/modify-outgoing-request-header)；边缘压缩参见[文件压缩](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/content-compression)。
