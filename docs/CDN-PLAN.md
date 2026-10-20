# CDN 接入评估

评估日期：2026-10-20。freakz2z.com 尚未完成 ICP 备案，因此当前不能开通中国大陆节点；国内厂商的境外节点可以作为试用候选，但不保证比 Cloudflare 更快。

## 候选

1. 阿里云 ESA 基础版：官方标价 9.9 元/月，含 50 GB。选择“全球（不含中国内地）”，使用 CNAME 接入，先测试再切主域名。
2. 腾讯云 EdgeOne：可比较免费/个人套餐的境外加速区域；个人版官方标价 29.9 元/月，含 50 GB 和 300 万请求。不同区域流量抵扣倍率与超额费用以订购页为准。

境外 CDN 的普通套餐不等同于跨境专线，也不是中国大陆节点加速。申请 ICP 备案后，再比较同一站点的大陆节点命中率与三网晚高峰性能。

官方文档：
- https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/basic-package-fee
- https://www.alibabacloud.com/help/zh/edge-security-acceleration/esa/support/site-access-related-issues
- https://cloud.tencent.com/document/product/1552/94158
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/back-to-source-sni/

## 本站接入方式（尚未实施）

保留 Workers、D1、R2。新增独立 Worker 源站域名后，CDN 回源该域名，回源 HTTPS Host 与 SNI 一致；PUBLIC_ORIGIN 继续为正式域名。不能把同一个加速域名再次用作回源域名造成循环，也不能把公开 CNAME 再交给 Cloudflare 橙云代理。

先用测试域名验证证书、Host/SNI、统计 POST Origin、示例接口与资源，再从真实大陆三网测试首屏/静态资源 P50/P95、冷缓存和晚高峰。验证收益后才切换正式域名解析。

| 路径 | CDN 策略 |
| --- | --- |
| `/assets/*` 内容哈希文件 | 按源站一年 immutable 缓存 |
| `/media/*` 普通 Logo | 按源站一小时缓存 |
| `/media/demos/*` 内容哈希资源 | 按源站长期缓存，核对实际资源路径 |
| `/api/catalog`、`/sitemap.xml` | 尊重源站 60 秒缓存和 ETag |
| HTML 页面 | 尊重 private/no-store，不能“缓存全部” |
| `/api/visitors`、`/api/labs/*`、`/api/health` | 跳过缓存；保留 POST 和条件/范围请求语义 |

首阶段收益主要来自静态资源命中。HTML 和实时 API 仍会回源 Cloudflare，不能宣称整个页面已经在境内处理。若之后需要缓存 HTML，必须先专门设计 CSP nonce、内容更新与页面缓存的一致性。

仅评估方案，尚未订购套餐、创建 CDN 站点或修改 DNS。
