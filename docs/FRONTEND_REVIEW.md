# 集成复核修订（在初版完成后执行）

你继续拥有 apps/web/** 和 data/catalog.json。不要改后端、shared、migrations、根配置和文档，不调用子代理。

Codex 已扩展 shared/contracts.ts 的 Tool.pricing union，现为「开源免费」「免费使用」「免费增值」「付费」。D1 也已支持。

1. GSAP 官方 README https://github.com/greensock/GSAP/blob/master/README.md 明确所有插件免费、使用 no-charge licence，不属于普通开源许可。把 catalog 中 gsap 的 pricing 改为「免费使用」，description/highlights 用准确原创中文说明插件免费、授权以官方标准许可为准；SwiftUI 改为「免费使用」，说明开发工具免费而上架计划另计。UI 的费用筛选和介绍支持四个类别，保留单独「开源免费」筛选，不把免费当成开源。
2. 当前 apps/web/package.json 的 Vite 5 被 npm audit 报告1高危1中危。请升级到 vite ^8.3.4 与 @vitejs/plugin-react 最新兼容版本（比如 ^6），Node22.23.2 支持；自行 npm install 更新锁文件属于依赖管理例外，可以改根 package-lock.json，但不要改根 package.json。运行 typecheck/build/npm audit 修复已知漏洞与类型错误。
3. SpringDemo tick 使用最大dt0.032的单步Euler，在阻尼40、质量0.5、低帧率时有数值发散风险。改为固定小步进/子步积分（每步不超过1/120秒），保证所有参数组合有限且稳定，尊重reduced-motion。
4. MarkdownDemo 的 characterCount 当前 source.length-source.replace(/\s/g,'').length 统计的是空白数，却显示「非空白字符」。改为 source.replace(/\s/g,'').length，并给textarea加合理maxLength防止过量输入卡死。
5. 检查首页文字中没有未经证据的「亲测全部工具」或虚构实时数据。「本站精选」由编辑选择即可。不要在网页上展示工具调用、开发调试或部署流程文字。当前OG文案「真正在用」如暗示全部亲测请换成中性词。
6. 检查并修正 typecheck/build。逐一核对至少 / /tools/react /demos /demos/spring-lab /demos/chart-studio /demos/gradient-studio /demos/kanban-board /demos/particle-field /demos/markdown-desk 路由。手机320/390宽度无横向溢出。不要只写修订计划，完成修改并报告。

后端 GET /api/catalog 当前可用，http://localhost:8787 提供D1与R2。Vite http://127.0.0.1:5173 已运行。种子迁移由Codex执行，不要改迁移。品牌已提供。

7. 已从 Playwright 查看第一版桌面1280x720截图：配色与排版很好，但首页hero约500px高，首屏看不到任何工具卡。目录产品应更紧凑：桌面hero控制约280-330px，主标题约40-46px，两行可接受，段落/统计/按钮减少纵向间距，让1280x720首屏能看到精选工具卡且有实质工具内容；手机也压缩，保持可读，不堆大字。保留现有暖色与衬线标题风格，不用全面重设计。

8. qa.spec.ts 当前硬编码5174并mock catalog。保留可选隔离测试，但默认验收要走真实接口：BASE用process.env.VIBE_TEST_BASE_URL || 'http://127.0.0.1:5173'；只有VIBE_TEST_MOCK==='1'时prepare才mock，默认不拦截。这样可复用同一套测试验证Workers及生产域名。新增 apps/web 的 test:e2e 脚本（playwright test qa.spec.ts --workers=1 --reporter=line），QA截图和test-results已gitignore，不要部署测试输出。

7b. 同样查看分类页，1280x720下首张工具卡起点约444px。请收紧分类页的「目录浏览/分类标题/描述/筛选chips/结果标题/筛选条」纵向间距，合并重复信息，使首张卡在约300-330px以内开始。保留说明和筛选功能，不删工具内容。
