# 技术实作示例服务契约

所有请求均为本站真实只读服务，GET/HEAD；不接受任意 SQL，不持久化访客输入。前端不要模拟这些返回值。

- `GET /api/labs/query?key=alpha&delay=400&fail=0`：TanStack Query / SWR 请求源。key 最长40字符，delay 0–1200毫秒，fail=1返回503（用于真实错误恢复）。成功 `{key,requestId,generatedAt,items:[{id,name,category}],count}`，数据实际从D1读取。缓存行为由对应SDK处理，响应 no-store。
- `GET /api/labs/hono/greet/:name?greeting=你好`：真实Hono路由参数和两层中间件。`{technology:'Hono',message,name,requestId,trace:[string],generatedAt}`，响应 `X-Demo-Router: Hono`、`X-Request-Id`。未知子路由404，非GET/HEAD405。不用POST演示虚假写入。
- `GET /api/labs/d1?view=summary&region=all&status=paid`：真实D1固定查询模板；view=orders|summary|ranking；region=all|华东|华南|华北|西部；status=all|paid|pending|refunded。`{technology:'Cloudflare D1',sql,parameters,rows:[object],durationMs,source:'demo_orders'}`。orders为订单明细，summary按地区聚合，ranking使用窗口函数做地区内排名。金额字段为整数分，全部是明确的示例订单。
- `GET /api/labs/drizzle?region=all&status=paid`：真实Drizzle D1驱动的关系查询：订单关联客户、可选条件、生成SQL与实际查询结果。`{technology:'Drizzle ORM',sql,parameters,rows:[{orderId,customer,region,status,totalCents}],source:'demo_orders + demo_customers'}`。
- `GET /api/labs/kysely?region=all&minimum=0`：Kysely真实构建可组合聚合查询，编译后在D1执行；minimum 0–100000分。`{technology:'Kysely',sql,parameters,rows:[{region,orderCount,totalCents}],source:'demo_orders'}`。
- `HEAD /api/labs/r2`：真实R2对象brand/logo.png的`Content-Length`、`Content-Type`、`ETag`、`Accept-Ranges:bytes`和`X-Object-Key`。`GET /api/labs/r2`可传标准Range头`bytes=0-63`获得206、Content-Range和真实二进制；If-None-Match匹配则304；不合法范围416。展示对象元数据、条件读取与分段读取；不要编造上传、目录、文件列表或R2写入。
- `GET /api/labs/htmx/search?q=...`：真实HTML片段，D1最多8条工具搜索结果，q最多80字符，返回Content-Type:text/html。用htmx的hx-get/hx-trigger/hx-target完成请求替换，禁止React自行fetch后冒充htmx。配置allowEval=false、allowScriptTags=false。

资源：需要独立WASM、Rive、Lottie、GeoJSON等资源时，放入`assets/demos/`，并维护`assets/demos/manifest.json`数组：`{key:'demos/<tool>/<content-hash-name.ext>',file:'assets/demos/...',contentType,sha256,source,license}`。source为官方仓库具体URL或npm包与锁定版本。实际读取URL是`/media/`+key；主代理同步本地/远程R2并按清单放行，不允许任意R2键、任意文件或CDN。

CSP支持script-src的wasm-unsafe-eval与worker-src self；不支持通用unsafe-eval、外部CDN、blob Worker。优先使用本地Worker URL或worker:false，不得为某个包放宽CSP。图片只允许本站/data/blob，网络请求保持本站。服务不可用时展示实际错误和重试入口，不使用假数据替代。
