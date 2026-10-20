# 搜索引擎与访问统计

## 可抓取页面

首页、工具详情、示例列表和示例详情都向所有访客输出同一份可读 HTML；正文与正式 React 界面共享组件。示例运行区仍在浏览器真实加载对应库，不以服务端假动画代替。

- robots.txt 允许抓取公共页面，排除 API。
- sitemap.xml 从 D1 目录快照生成，包含首页、示例列表和全部详情，lastmod 使用实际内容更新日期。
- 每页输出独立的标题、描述、canonical、Open Graph 与 JSON-LD。
- 筛选、搜索、收藏页和备用主机标记 noindex，避免重复内容；未知页面返回 404。
- HTML 保持每次响应独立 CSP nonce 与 private/no-store；不能在 CDN 强制缓存此类 HTML。

IndexNow 验证文件部署后，执行 `npm run indexnow -- https://vibe.freakz2z.com`，向参与该协议的搜索引擎提交当前站点地图中的 URL。HTTP 200 表示已接收，202 表示验证待处理；两者都不代表已经收录。新增或更新目录后重新执行。

2026-10-20 已通过站点所有者现有 Google 登录会话取得 HTML 标记并完成 Search Console 所有权验证，验证标记保留在首页源码中。IndexNow 已接收 276 个 URL（HTTP 200），回执保存在本机忽略目录 artifacts/。这不是搜索结果收录证明。

Google 站点地图通过 Search Console 提交。百度搜索资源平台尚未完成账号与站点验证；IndexNow 不代替 Google 或百度的站长平台。

## Footer 访客统计

Footer 展示累计访客、今日访客，采用本站 `/api/visitors` 和 D1，不依赖第三方统计脚本。

- 浏览器首次访问生成随机 UUID，保存于 localStorage；服务器只存带固定站点前缀的 SHA-256 哈希，不存原始 UUID、IP、User-Agent 或来源网址。
- 累计按浏览器标识去重，今日按北京时间自然日去重。相同访客重复刷新、多个标签页并发提交均不增加计数。
- 清除本机数据、更换浏览器或设备会产生新标识。因此这是匿名浏览器访客数量，不能解释为现实中的精确人数。能执行 JavaScript 的机器人可能计入；没有反作弊准确率承诺。
- 禁用 JavaScript 的抓取器不写入统计；localStorage 不可用时仅读取。网络失败显示破折号，不伪造数字。
- 从统计功能实际部署开始记录，不补填历史流量。GET 仅读取；POST 校验 Origin、JSON 类型、UUID 与请求体上限。统计接口始终 no-store/noindex，CDN 需跳过缓存。

新增迁移 `0014_visitor_statistics.sql` 只创建统计表，不更改已有目录数据或迁移。
