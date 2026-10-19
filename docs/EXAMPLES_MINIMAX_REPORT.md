# 技术栈示例实现记录

2026-10-19。现有 **219 个工具、55 个专属示例**，其中 50 个在浏览器运行对应库，5 个调用本站真实服务。一例一个主工具，只有这 55 个工具有 `demoId`。

## 实现与接手

示例初稿由用户指定的 Claude Code CLI / MiniMax-M3.1-Flash-Preview 编写。额度用尽后停止调用，由 Codex 接手前后端、地图、动画、编辑器修正、文案、验收及发布。不能将初稿报告中的加载成功等同于最终验收。

- Remark 的插件工厂、Matter.js 的刚体生成回调与静态首帧已修正，并补充功能操作检查。
- 地图使用本站 R2 的 Natural Earth 国家边界快照，共 177 个要素；Leaflet 展示 GeoJSON 图层、属性着色和定位，MapLibre 展示 WebGL 图层、表达式着色和相机控制。
- Lottie 使用本站原创六图层动画，展示 Trim Paths、关键帧、逐帧和分段控制。
- GSAP 支持实际时间轴倒放、暂停和 Draggable 播放头；显示时长为时间轴时长除以播放速率。
- ECharts 使用 dataset 的 encode 映射横轴，缩放区间由实际 dataZoom 回读，包含 45 天样本、缩放与峰值窗口的功能检查。
- PixiJS 使用官方 CSP 兼容模块、实际画布和共享纹理精灵；不显示推测的绘制批次数。
- ProseMirror 使用有效 schema 文档与真实事务；Lexical 展示当前不可变状态和历史栈；CodeMirror 的语法节点统计来自真实语法树。
- TanStack Query / SWR 请求本站接口；D1 / Drizzle / Kysely 实际查询 D1，订单和客户为虚构示例数据。
- R2 实际读取本站品牌对象，支持 HEAD、ETag 条件 GET、Range、304、206、416。

## 示例清单

| 示例路由 | 主工具 | 展示能力 |
| --- | --- | --- |
| `gsap-timeline` | GSAP | GSAP 时间轴串起四个阶段，拖动播放头查看任意进度，支持暂停、倒放与缓动切换。 |
| `motion-layout` | Motion | 用 Motion 的 layoutId 让同一个元素在两个容器之间连续变形，过渡期间由 Motion 接管真实布局计算。 |
| `spring-physics` | React Spring | 调整张力与摩擦系数，React Spring 按真实弹簧方程收敛，多个元素用 useSprings 错峰触发。 |
| `three-instanced` | Three.js | 用 InstancedMesh 绘制数千个实例，配合方向光与环境光渲染，并可拖动改变观察视角。 |
| `pixi-sprite-batch` | PixiJS | PixiJS 绘制共享纹理的数千个精灵，可调整数量、纹理和混合模式，观察叠色与帧间耗时。 |
| `matter-rigid` | Matter.js | Matter.js 实时解算刚体碰撞、堆叠与重力，鼠标可直接拖拽物体，约束器构成单摆。 |
| `paper-boolean` | Paper.js | 对 Paper.js 路径做相交、并集、差集与排除运算，实时看到运算后的真实路径结果。 |
| `anime-svg` | Anime.js | Anime.js v4 时间轴驱动真实 SVG 属性：路径变形、描边绘出与元素错峰入场。 |
| `lottie-vector` | Lottie Web | Lottie 播放六图层矢量动画，展示路径描边与错峰关键帧，可逐帧查看、分段播放和倒放。 |
| `swiper-pager` | Swiper | Swiper 处理真实触摸滑动与分页吸附，示例读取实例当前的 realIndex，支持循环与自动播放开关。 |
| `embla-snap` | Embla Carousel | Embla 计算真实滚动吸附点，切换对齐方式后落点随之改变，并可把幻灯片拖拽重新排序。 |
| `dnd-board` | dnd-kit | dnd-kit 驱动多列看板的拖拽排序，支持列内与跨列移动，并可用键盘完成同样的操作。 |
| `autoanimate-list` | AutoAnimate | 点击增删与重排列表元素，AutoAnimate 在 React 更新后接管真实 DOM 差异并补间，无需手写动画。 |
| `moveable-transform` | Moveable | Moveable 给元素加上真实的拖动、缩放与旋转手柄，数值随指针实时更新，并可吸附到网格。 |
| `echarts-dataset` | ECharts | ECharts 用一份 dataset 驱动多条系列，图例开关与 dataZoom 缩放会同步作用于同一份数据。 |
| `d3-datajoin` | D3 | D3 用 enter/update/exit 三段式真正连接数据，配合线性与分段比例尺和坐标轴，切换数据可看到增删更新计数。 |
| `chartjs-mixed` | Chart.js | Chart.js 在同一画布上组合柱状与折线双坐标轴，并切换图表类型，悬停读取真实数据点。 |
| `recharts-brush` | Recharts | Recharts 的 Brush 拖出时间区间后，主图表与其他图表同步筛选，联动的是同一份数据源。 |
| `plot-binning` | Observable Plot | Observable Plot 对真实样本做分箱计数并绘制直方图，可切换分箱数量与阈值分布方式。 |
| `uplot-zoom` | uPlot | uPlot 绘制两万点级别的密集时序，拖动光标选区可真实缩放区间，并支持继续追加数据。 |
| `g6-graph` | AntV G6 | G6 对真实关系图运行力导向布局，可拖动节点，点击后高亮该节点的全部邻居。 |
| `x6-ports` | AntV X6 | X6 节点带真实连接端口，从端口拖到另一节点即可连线，可删除连线并导出当前图结构。 |
| `mermaid-render` | Mermaid | Mermaid 把图表文本解析为 SVG，可在多种图类型间切换，写错语法时显示真实解析错误。 |
| `reactflow-canvas` | React Flow | React Flow 提供可拖拽节点与端口连线，并按真实拓扑顺序对节点重新分层排序。 |
| `leaflet-geojson` | Leaflet | Leaflet 渲染 Natural Earth 真实国界 GeoJSON，图层可切换，填充色随人口属性变化，支持真实地理缩放。 |
| `maplibre-webgl` | MapLibre GL JS | MapLibre 用 WebGL 渲染真实国家边界，按洲或人口属性着色，可筛选、定位、缩放与旋转。 |
| `zod-schema` | Zod | Zod 用 safeParse 校验嵌套表单，逐个字段展示真实的 issue 路径与错误码。 |
| `tanstack-cache` | TanStack Query | TanStack Query 对同一 key 的并发请求真正去重为一次，可手动失效重取，并演示真实 503 后的重试。 |
| `swr-revalidate` | SWR | SWR 在切换 key 时保留上一份数据直到新数据到达，并区分首次加载与后台重验证。 |
| `zustand-store` | Zustand | Zustand 用选择器订阅状态切片，只有依赖该切片的组件会重渲染，并记录订阅触发的真实次数。 |
| `redux-entities` | Redux Toolkit | Redux Toolkit 用 entityAdapter 管理大量实体，派生选择器做记忆化统计，并记录真实派发的 action。 |
| `jotatom-derived` | Jotai | Jotai 由基础原子派生出过滤结果与汇总值，任意基础原子变化都会沿依赖链重算。 |
| `htmx-fragment` | htmx | htmx 自行发起请求并把服务端返回的 HTML 片段替换进页面，示例配置禁止求值与脚本标签。 |
| `radix-focus` | Radix UI | Radix UI 的无样式原语实现真实焦点陷阱、Esc 关闭与关闭后焦点回到触发元素，标签页可用方向键切换。 |
| `antd-table` | Ant Design | Ant Design 表格同时提供多列筛选、排序与分页，筛选结果与行数由组件真实计算。 |
| `mantine-steps` | Mantine | Mantine 用 Stepper 组织分步表单，每步校验通过后才能进入下一步，最后汇总提交内容。 |
| `tiptap-json` | Tiptap | Tiptap 把编辑内容表示为结构化 JSON 文档，实时导出当前文档结构而不只是 HTML。 |
| `lexical-history` | Lexical | Lexical 以不可变 EditorState 保存每次编辑，撤销栈记录真实历史深度，可逐步回退。 |
| `prosemirror-steps` | ProseMirror | ProseMirror 的每次编辑都是一个真实事务，可展开查看该事务产生的步骤结构。 |
| `quill-delta` | Quill | Quill 用 Delta 描述文档的全部变更，示例实时展示 ops，并可通过程序组合成新的 Delta。 |
| `codemirror-ext` | CodeMirror | CodeMirror 提供真实的语法高亮、代码折叠、搜索与补全，可切换语言与自动换行。 |
| `markdown-safe` | markdown-it | markdown-it 解析 Markdown 后按 token 逐个渲染成安全元素，脚本标签只会被当作文本转义。 |
| `shiki-theme` | Shiki | Shiki 用 TextMate 语法真实着色代码，可切换主题与语言，并展示真实的高亮 token 数量。 |
| `katex-typeset` | KaTeX | KaTeX 实时排版数学公式，公式写错时显示真实的 TeX 解析错误而不是静默失败。 |
| `remark-ast` | remark | Remark 解析出真实的 Markdown 语法树，经净化插件后再转成 HTML，脚本与危险属性会被移除。 |
| `culori-interpolate` | Culori | Culori 在不同色彩空间间做真实插值，切换空间会得到明显不同的过渡色，并给出对比度读数。 |
| `colorjs-gamut` | Color.js | Color.js 判断颜色是否超出 sRGB 色域并映射回可用范围，同时用 ΔE2000 计算真实色差。 |
| `prettier-format` | Prettier | Prettier 的 standalone 版在浏览器里真实格式化代码，切换选项会改变输出，语法错误显示原始报错。 |
| `tsc-diagnostics` | TypeScript | TypeScript 编译器在内存中检查虚拟工程，输出真实的错误码、消息与行列位置。 |
| `esbuild-compile` | esbuild | esbuild-wasm 在浏览器里编译 TypeScript 与 JSX，可切换压缩与目标版本，并显示真实编译耗时。 |
| `d1-sql` | D1 | 请求本站真实 D1 接口，展示服务端实际执行的 SQL、绑定参数、结果与耗时；数据为虚构示例订单。 |
| `drizzle-join` | Drizzle ORM | 本站 Drizzle 接口返回由关系查询真实生成的 SQL 与结果，包含订单与客户的连接与可选条件。 |
| `kysely-aggregate` | Kysely | 本站 Kysely 接口编译可组合的聚合查询后交给 D1 执行，门槛变化会真实改变返回结果。 |
| `hono-router` | Hono | 请求本站 Hono 路由，展示真实响应头、路由参数与两层中间件的执行顺序，并可触发真实 404。 |
| `r2-range` | R2 | 本站 R2 接口返回对象真实元数据，可用 ETag 条件请求与 Range 字节范围读取，包含 304 与 416 状态。 |

## 资源与运行边界

- 独立资源见 `assets/demos/manifest.json`，源链接、许可、MIME、SHA-256 可复核；后端只允许清单中的键。
- 地图快照从 Natural Earth 原数据提取并重命名四个属性，保留真实几何；人口估计是快照值。详见 [资源说明](ASSETS.md)。
- esbuild WASM 由本站 R2 提供；访客代码只编译和展示，不执行。
- CSP 不允许 JavaScript 字符串求值。MapLibre 使用同源模块 worker，Lottie 使用官方 light 构建，PixiJS 使用官方静态同步 polyfill，htmx 关闭 `allowEval` 和脚本标签。
- 库按示例动态加载；地图、编辑器与渲染器在卸载时释放实例。第三方全局样式置于低优先级 CSS layer。
- 真实运行需要相应浏览器能力；WebGL 不可用时显示错误，不生成替代结果。

## 验证口径

自动检查包含目录一对一关联、55 个示例的运行检查、重点示例的功能操作、320px 两种主题和既有目录/筛选/收藏流程。部分示例的自动检查只确认 SDK 输出与页面加载，不能据此声称所有控件和所有库能力已穷尽测试。验收结果、服务接口检查与线上状态见 [验收记录](VALIDATION.md)。

直接依赖版本和许可见 [依赖清单](DEPENDENCIES.md)。运行依赖审计剩余一项 low：Quill 2.0.3 的 `getSemanticHTML()`；本站仅使用 Delta API，不调用该 HTML 导出路径。保留审计结果，不用强制降级处理。

没有示例的工具仍保留资料、官方入口与 Logo。需要终端、桌面环境、账号或独立服务才能展示的功能不通过通用演示代替；本期未做专属示例的工具不附示例链接。
