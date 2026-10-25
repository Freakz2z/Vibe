# 示例逐项复核

检查日期：2026-10-25。范围为目录内全部 55 个示例，主要验收环境为 Bilibili Toy 的真实预览页面。最终验收预览：[打开预览](https://www.bilibili.com/toy/preview/author_4V6BFy1D/index.html)，未提交审核。

## 本次调整

- Three.js：重新制作彩色实例球，共用几何与材质；实际绘制调用从 `renderer.info` 读取。相机按画布比例取景，OrbitControls 支持拖动与双指缩放，暂停后仍能改变视角。
- PixiJS：用本地产生的圆点、圆环、星形纹理制作粒子场，调整尺寸、配色及归一化位置，消除原来大面积叠色的画面。混合模式和精灵数量直接可见。
- Matter.js：遍历所有嵌套 Composite 中的刚体，修复“有数量、没画面”；按实际顶点绘制旋转方块，增加暂停/运行，暂停时新增与清空也能立即显示。重置恢复初始刚体。
- Lottie：修正颜色透明度、空间贝塞尔切线和柱状图坐标；重置回到第一帧。描边、勾选和环绕均由真实 JSON 关键帧运行。
- Paper.js：初始形状保持足够交叠，交集、差集、并集可立即看出区别；运算选择直接可见。
- D3：根据容器宽度重新计算比例尺与坐标轴，保留真实 keyed join；小屏显示中文分类与数值。
- Chart.js、Recharts、Plot、G6：主要模式可直接切换。Recharts 图表填满容器，Brush 增加趋势概览；Plot 均值线改为评分轴上的位置；G6 使用短中文标签和分组颜色。
- React Flow：Toy 初始节点采用两列，保留可读缩放，移除会遮住手机画布的缩略图。
- React Spring：依据容器计算弹簧的行程，终态回到中央，避免窄屏裁切。
- Lexical、Quill、ProseMirror、CodeMirror、Shiki、KaTeX、TypeScript、Moveable、X6：补齐文档、历史或选项的完整重置。
- Leaflet：隔离地图内部控件层级，参数弹窗不会被缩放按钮覆盖；重复重置统一回到世界边界视野。
- HTMX：失败请求只计数一次，400 与网络错误保留上一份成功内容并显示错误；Hono 重置时取消在途请求。
- SWR：每次进入示例使用独立缓存，避免离开时被取消的请求污染下一次进入；503 后支持手动恢复。
- 统计：区分数字、范围与说明文本；长数字采用更宽的列，避免拆行。

## 验收方法

逐例执行主要操作、检查对应库实际输出，再重置并比较输入和设置。额外遍历所有原生下拉选项、开关、滑块以及声明的分段模式。Canvas/WebGL 示例比较实际画面变化，不能仅凭画布存在或统计数字判定效果正常。

B站包装页与实际内容 iframe 分别核对。依赖后端的示例直接访问正式只读接口，不用模拟响应替代。原生连接、正向缩放、取消拖动、物理拾取以及 Motion 触摸手势另行验证。

截图与逐项结果保存在本机 `output/playwright/showcase-audit/`（Git 忽略），包括进入界面、操作后界面、320/390 手机截图及亮暗主题检查。真实手机 B站 App 的表现仍以用户预览验收为准。

## 参考来源

以下仅用于核对库能力、API 和构图思路；本次场景与纹理在项目内实现，没有热链第三方演示页面，也没有把录像作为实时示例。

| 技术 | 官方参考 | 许可 |
| --- | --- | --- |
| Three.js | [动态实例化示例](https://threejs.org/examples/webgl_instancing_dynamic)、[OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| PixiJS | [粒子示例](https://pixijs.com/8.x/examples/basic/particle-container/) | [MIT](https://github.com/pixijs/pixijs/blob/dev/LICENSE) |
| Matter.js | [Composite.allBodies](https://brm.io/matter-js/docs/classes/Composite.html#method_allBodies) | 依赖许可见项目清单 |
| Paper.js | [布尔运算示例](https://assets.paperjs.org/boolean/) | 依赖许可见项目清单 |

PixiJS 本例使用 `Container` 与 `Sprite` 共享纹理，不声称使用 `ParticleContainer`，也不虚构绘制调用次数。Three.js、PixiJS 显示的帧间隔不是 GPU 耗时。

## 已验证结果

- 全部 55 个示例主要操作及重置通过。参数遍历覆盖 270 次选项/滑块/开关/模式操作，55 个示例均通过设置恢复核对。
- Toy 在 320/390 宽度、浅色/暗色下共 220 个页面检查通过，无页面横向溢出、折叠为零的画布或残留错误。之前整轮 768/1280 检查也覆盖全部示例；最终包对重点画布和弹窗另作抽查。
- 原生鼠标检查通过 X6 两次端口连线、Moveable 正向缩放、跨列拖动取消和 Matter.js 按实际比例拾取。Motion 共享布局、拖动边界及归位，以及 Swiper/Embla 滑动、Three.js 暂停旋转、Moveable 拖动通过浏览器触摸仿真。
- HTMX 400、TanStack Query 503/恢复/去重、SWR 503/恢复、Mermaid 错误/恢复、R2 条件/范围读取、Hono 404/恢复共 6 项附加路径通过。
- 生产构建、Toy 构建、类型检查、24 项后端测试、正式目录 API 与 27 项服务检查通过。80 项桌面/手机站浏览器回归通过；新增的刚体实际绘制、Moveable/X6 重置回归另行通过。

| 示例 | 核对内容 | 结果 |
| --- | --- | --- |
| gsap | 时间轴播放、暂停、倒放及播放头 | 通过 |
| motion | 共享元素迁移、退出补位及拖动约束 | 通过 |
| react-spring | 弹簧重播、阻尼切换 | 通过 |
| threejs | 暂停后旋转视角、实例数及实际绘制调用 | 通过 |
| pixijs | 精灵数量、混合模式及画面更新 | 通过 |
| matterjs | 嵌套刚体可见、暂停增删与约束 | 通过 |
| paperjs | 交并差集、面积变化及画布拖动 | 通过 |
| animejs | 重播、倒放和回到开头 | 通过 |
| lottie-web | 逐帧、播放和三个动画区段 | 通过 |
| swiper | 前后翻页及进度 | 通过 |
| embla-carousel | 吸附分页及回到开头 | 通过 |
| dnd-kit | 拖动、跨列取消及恢复 | 通过 |
| auto-animate | 添加、过滤和排序 | 通过 |
| moveable | 真实拖动/正向缩放、开关恢复 | 通过 |
| echarts | 窗口缩放与峰值对齐 | 通过 |
| d3 | keyed join 的新增/复用/退出 | 通过 |
| chartjs | 雷达/混合图、图例与 PNG 导出 | 通过 |
| recharts | Brush 双向同步、数据切片及指标切换 | 通过 |
| observable-plot | 分箱策略、数量和样本总数 | 通过 |
| uplot | 实时追加、暂停与缩放 | 通过 |
| g6 | 三种真实布局切换及拓扑不变 | 通过 |
| x6 | 连续新增、JSON 回载及原生端口连接 | 通过 |
| mermaid | 文本渲染、错误提示及恢复 | 通过 |
| react-flow | 新增节点、布局和可读缩放 | 通过 |
| leaflet | 洲过滤、选国、图层和全图重置 | 通过 |
| maplibre-gl | 图层过滤、实际 WebGL 绘制 | 通过 |
| zod | 不合法字段与合法数据恢复 | 通过 |
| tanstack-query | 重新请求、缓存及六观察者去重 | 通过 |
| swr | 重新验证、503 恢复及重新进入 | 通过 |
| zustand | 购物车与优惠券状态传播 | 通过 |
| redux-toolkit | 删除后新增、批量后新增与派生数据 | 通过 |
| jotai | 新增任务与派生原子更新 | 通过 |
| htmx | 真实 HTML 替换、400 保留内容及链接 | 通过 |
| radix-ui | 对话框焦点约束和关闭后恢复 | 通过 |
| ant-design | 表格选择、筛选与分页 | 通过 |
| mantine | 校验阻止前进、三步填写与提交摘要 | 通过 |
| tiptap | 输入、格式、结构化 JSON 和重置 | 通过 |
| lexical | 真实编辑历史撤销/重做及重置 | 通过 |
| prosemirror | 事务插入、撤销与完整文档重置 | 通过 |
| quill | Delta 追加、合成及初始文档恢复 | 通过 |
| codemirror | 搜索、折叠、语言/折行参数与重置 | 通过 |
| markdown-it | Markdown 实时解析及安全输出 | 通过 |
| shiki | 语言/主题切换与高亮输出 | 通过 |
| katex | 有效公式、解析错误与恢复 | 通过 |
| remark | Markdown 解析、AST 和预览 | 通过 |
| culori | 多种色彩空间、色阶及插值 | 通过 |
| colorjs | 色域映射、对比度及参数切换 | 通过 |
| prettier | 格式化、语法错误与恢复 | 通过 |
| typescript | 真实诊断、零错误与语法错误 | 通过 |
| esbuild | WASM 编译、错误恢复及 loader 切换 | 通过 |
| d1 | 三种 SQL 视图及地区/状态过滤 | 通过 |
| drizzle | 真实连接查询和过滤 | 通过 |
| kysely | 真实聚合、金额门槛及空结果 | 通过 |
| hono | 路径参数、真实 404 及恢复 | 通过 |
| r2 | HEAD、完整图片、304 与 206 字节范围 | 通过 |
