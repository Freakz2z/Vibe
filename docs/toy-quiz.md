# Toy 游戏与模型服务

游戏《这也敢上线？》是五回合手机情境问答。十个固定案例涵盖需求描述、排错、验证、密钥、数据保存和开发范围；每局抽五个。选项随机排序，反馈后可看指令示例，结算可逐题复盘。本机保存最佳分，不提供虚构排名。

## 贴纸与预览

角色为六种姿态的原创机器人贴纸；原图、提示词与压缩文件说明见 `assets/games/quiz/README.md`。动效只作用于反馈、入场和贴纸；没有 hover 容器位移，支持系统“减少动态效果”。

Toy 正式页面通过 `toy.isSupport('getAuthorRelation')` 和 `toy.getAuthorRelation()` 检查 `status === 'ok' && data.isFollowing === true`。读取失败不解锁；本地缓存不充当关注凭证。

平台预览页实际返回 `toy id not available on host`，因此仅在 `/toy/preview/author_<token>/` 路径且关注能力不可用时，提供明确标注的“预览试玩（固定题库）”。它不显示“已关注”，不调用模型，不存在正式路径上的 query 开锁参数。

## 模型接入

在仓库根目录运行：

```sh
npm run model:configure
```

命令隐藏输入密钥，保存到权限 0600 且被 Git 忽略的 `services/model-api/.dev.vars`，通过 stdin 上传 Cloudflare Worker Secret；不会把密钥放到参数、前端或聊天记录。未配置时服务关闭模型功能，游戏显示固定题库。上传成功后重新打开 Toy；还需要真实联网验收，不能把本地 fixture 测试当作 OpenRouter 成功。

## 安全边界

没有系统能够承诺绝对安全。当前方案保护模型密钥、限制公开 API 能做的事并对模型消费设置上限。Toy 的客户端关注状态和 `toyOpenId` 不提供后端可验签凭证，因此关注解锁属于界面访问控制，不能称为服务端身份认证。对模型的防滥用独立处理。

- `vibe-toy-model`：没有公开路由、`workers_dev: false`、`preview_urls: false`。仅由目录 Worker 的 `TOY_MODEL` Service Binding 调用。Secrets 只在这个私有 Worker。
- 公共入口为 `/api/toy/game/config|session|quiz|answer|judge`。只放行 B站两个精确 Origin，CORS 不作为鉴权；禁止任意模型、提示词、URL 或聊天代理任务。
- 会话建立要求服务端 Turnstile Siteverify 校验成功、预期 hostname 和 action。验证凭据单次使用；会话为 256 位随机值，服务端只存 SHA-256，绑定 Origin 与经盐哈希的来源 IP，15 分钟有效，不使用 Cookie，不持久化前端 token。
- 一个 SQLite Durable Object 统一原子额度：默认全局每天 20 次模型调用、每分钟 4 次；最多配置到每天 40 次；每 IP 每天 5 个会话、每分钟 30 个请求及验证次数上限。额度在上游调用前预留，失败也消耗，不自动重试。全局入口还有每天 8,000 次上限。这是应用层限制，不是零成本或抗所有 DDoS 的承诺。
- 问题包单独存 D1 `vibe-toy-quiz`，按 UTC 日期缓存，同日并发生成合并。选择题不用逐次调用模型。失败有冷却，达到额度可以玩固定题库。
- OpenRouter 固定 `openrouter/free` 或受控的 `:free` 模型名，路由价格上限为零；没有付费降级。请求与响应有字节、长度、时间和结构限制，拒绝重定向，不输出上游原始错误或密钥。
- 模型只改写人工案例的叙述与反馈；正确选项仍由服务端题库决定。自由输入仅第五题可用，每局最多请求一次；模型必须给出玩家原文证据，服务端按三项标准算分。输入按数据处理，没有工具调用或写库权限；最终文本由 React 转义渲染。输入会发送给 OpenRouter 及其选用的模型供应商，界面提交前有说明。
- 题目属于会话、按序回答；相同提交幂等，不同答案不能覆盖已结算结果。模型无权限访问目录库、R2 或 Cloudflare 管理接口。

模型免费供应商的可用性、质量与数据政策可能变化；密钥应专用于此项目并在 OpenRouter 端也设置预算。不将密码、密钥等敏感内容写入游戏指令。

## 验证

`npm test` 覆盖固定任务、Origin、请求上限、模型路由与输出验证；`npm run test:model` 在真实 workerd、SQLite Durable Object 和 D1 上验证并发、重放、越权、评分和全局额度。测试使用明确的本地上游 fixture，不消耗真实模型请求。浏览器验收分别记录测试 SDK fixture 和真实 Toy 预览，二者不混称真实关注验证。

部署顺序为私有 Worker → Secrets → 主 Worker Service Binding → Toy 预览；Toy 审核等待用户验收后单独确认。

### 2026-10-25 验收记录

- 生产构建、Toy 构建与类型检查通过；32 项后端测试、14 条本地 workerd 安全路径、80 项原站浏览器回归通过。
- 真实 Toy 预览在 320 / 390 像素宽度完成五题、结算、逐题复盘和重开；该次页面没有脚本异常或缺失资源。额外检查了 430 像素和桌面、深色主题、减少动态效果，以及本地明确 fixture 下的关注拒绝、AI 点评和错误回退。
- 最终预览：https://www.bilibili.com/toy/preview/author_SR1dcYYa/index.html 。仅生成预览，没有提交审核。
- Cloudflare 已读回私有 Worker 的公开子域和版本预览均关闭、主 Worker 绑定正确；正式域名 D1 / R2 健康，目录 219 个工具。未配置模型密钥时 `configured: false`，模型请求返回 503；错误来源返回 403，批准来源的预检返回 204。
- OpenRouter Key 尚未提供；真实模型调用、真实 Turnstile 完整流程与正式 Toy 的关注结果仍待联网验收。当前不声称这些已经通过。
