# 阿里云 ESA 免费版接入测试

更新：2026-10-20。免费版测试站已建立，**正式域名尚未切换到 ESA**。freakz2z.com 尚未 ICP 备案，本次选择“全球（不包含中国内地）”，实际样本命中香港节点，不能称为中国大陆节点加速。

## 当前配置

| 项目 | 配置 |
| --- | --- |
| ESA 站点 | freakz2z.com，站点 ID `184586157250796`，CNAME 接入 |
| 套餐 | 已有免费版资源；本次未购买付费套餐，自动续费关闭 |
| 测试入口 | https://vibe-cdn-test.freakz2z.com/ |
| ESA CNAME | `vibe-cdn-test.freakz2z.com.a1.initxx.com`，Cloudflare DNS only |
| 回源 | `vibe-origin.freakz2z.com`，同一个 Cloudflare Worker |
| 回源协议 | HTTPS 443，Host 跟随源站域名，SNI 跟随 Host |
| 测试证书 | Let's Encrypt，控制台显示正常；有效 HTTPS 已验证 |
| 原正式入口 | https://vibe.freakz2z.com/，仍由 Cloudflare Worker 自定义域名提供 |

Workers、D1 和 R2 保留。新增 `_esaauth` 所有权校验 TXT、测试域名 CNAME、测试证书托管 DCV CNAME，以及独立回源域名；没有修改根域、www 或其他服务的解析。

Worker 仅在专用回源域名上识别白名单 `X-Vibe-Forwarded-Host`；测试和直接回源页面带 `noindex`，canonical 继续指向正式站。访问统计允许测试域名的同源 POST，保留来源和请求体校验。

## 已验证与待修复

- 生产构建、类型检查、20 项后端单测通过。
- 正式站和测试站各 20 项桌面/移动浏览器检查通过。
- 测试站目录 API、27 项真实服务检查、3 项真实运行资源哈希与条件请求检查通过；D1/R2 ready，219 个工具、55 个示例。
- Logo 和入口 JS 实际出现 ESA `X-Site-Cache-Status: HIT` / `Age`；HTML 保持 `private, no-store`，两次响应 CSP nonce 不同。
- **压缩协商待修复**：入口 JS 被首次缓存成 zstd 后，向仅声明 gzip/deflate 的 curl 仍返回 zstd，导致 curl 61；新查询参数的冷请求可正确得到 gzip。现代浏览器回归通过不能替代此兼容性检查。需规范 ESA 回源 Accept-Encoding、清理旧压缩缓存，再交替验证不同编码的响应和内容。
- **测试地址跳转待修复**：当前 ESA 请求头操作为“变更”，只覆盖已有请求头，未替缺失请求头创建值。无该头的 `/tools/react/` 会安全跳回正式站；已有任意该头时会被覆写为测试域名。应调整为可创建并覆盖的配置，再确认测试地址跳转仍留在测试域名。
- 强制 HTTPS 尚未开启；有效证书已生效，待恢复控制台后开启并核对 HTTP Location。

2026-10-20 的后续控制台操作因 Mac 锁屏暂停。以上三个问题未复验前，不切换正式域名。

## 当前网络测速

同一台机器直连，curl 明确禁用代理，两个入口每种路径各 7 次，单请求 20 秒超时，分别创建连接。Cloudflare 样本为 LAX，ESA 样本为香港。只有一个网络样本，不代表全国三网或晚高峰表现。

| 内容 | Cloudflare 完整下载成功 | ESA 完整下载成功 | Cloudflare 成功样本下载中位数 | ESA 成功样本下载中位数 |
| --- | --- | --- | --- | --- |
| 首页 HTML 文档 | 3/7 | 7/7 | 12.100 秒 | 1.173 秒 |
| Logo PNG | 6/7 | 7/7 | 10.399 秒 | 0.658 秒 |
| 入口 JS | 5/7 | 0/7 | 8.417 秒 | 不可比较：7 次压缩解码失败 |

首页数字仅是 HTML 文档下载，不是浏览器完整首屏时间；中位数只包含完整成功样本，失败次数单列。测试表明当前线路有改善潜力，但压缩问题使现阶段不具备切换条件。原始记录保存在本机忽略目录 `artifacts/cdn-benchmark.json`，不能把 JS 仅收到响应头的耗时列为成功下载。

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

## 正式切换前

1. 先解决上述压缩、跳转与 HTTP→HTTPS 问题，复验不同客户端、真实浏览器、统计与示例。
2. 补充电信/联通/移动和晚高峰样本；免费境外 CDN 不保证所有地区更快。
3. 单独为正式域名创建 ESA 记录、有效证书、Host 转发规则，并保持测试域名 noindex。
4. 再解除正式域名 Worker 自定义绑定、将其 DNS 改为正式 ESA CNAME，保留专用回源绑定。当前不执行此步骤。
5. 核对正式域名 canonical/noindex、重定向、D1/R2、统计与运行资源；有异常恢复原 Worker 自定义域名。

官方文档：[免费版](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/free-plan)、[套餐能力比较](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/package-function-comparison)、[接入地域与备案](https://help.aliyun.com/zh/edge-security-acceleration/esa/getting-started/add-your-website-to-esa)、[回源 SNI](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/back-to-source-sni/)。
