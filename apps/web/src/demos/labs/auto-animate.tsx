import { useEffect, useMemo, useRef, useState } from 'react';
import autoAnimate from '@formkit/auto-animate';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Segmented, Select, Stat, Stats, Status, useMotionOk } from '../lab-kit';

interface Item {
  id: number;
  name: string;
  group: '前端' | '图形' | '数据' | '系统';
  score: number;
}

const GROUPS: readonly Item['group'][] = ['前端', '图形', '数据', '系统'];
const NAMES = ['布局过渡', '合批渲染', '弹簧积分', '布尔路径', '吸附滚动', '指针轨道', '实例矩阵', '刚体约束', '关键帧', '合并器', '形变插值', '空间索引'];

function seedItems(): Item[] {
  return NAMES.map((name, i) => ({
    id: i + 1,
    name,
    group: GROUPS[i % GROUPS.length],
    score: ((i * 37) % 100) + 1,
  }));
}

type GroupFilter = Item['group'] | 'all';

/** @formkit/auto-animate：真实 DOM 变更的 FLIP 补间，分别用 hook 与命令式 API。 */
export default function AutoAnimateLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const [items, setItems] = useState<Item[]>(seedItems);
  const [nextId, setNextId] = useState(NAMES.length + 1);
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [tiles, setTiles] = useState<number[]>(() => [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [sortMode, setSortMode] = useState<'none' | 'score' | 'name'>('none');
  const [animationsOn, setAnimationsOn] = useState(true);

  const [listRef, enableList] = useAutoAnimate<HTMLDivElement>(motionOk ? { duration: 260, easing: 'ease-in-out' } : { duration: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  // Imperative API on the same page: autoAnimate(ref, options) returns a controller.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const controller = autoAnimate(el, motionOk ? { duration: 320, easing: 'ease-in-out' } : { duration: 0 });
    return () => {
      controller.disable();
    };
  }, [motionOk]);

  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.group === filter)), [filter, items]);

  const add = () => {
    const id = nextId;
    setNextId((n) => n + 1);
    setItems((prev) => [
      ...prev,
      {
        id,
        name: `${NAMES[(id - 1) % NAMES.length]}·${id}`,
        group: GROUPS[id % GROUPS.length],
        score: ((id * 29) % 100) + 1,
      },
    ]);
  };

  const removeLast = () => setItems((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const shuffle = () =>
    setItems((prev) => {
      const next = prev.slice();
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });

  const sort = (mode: 'score' | 'name') => {
    setSortMode(mode);
    setItems((prev) => prev.slice().sort((x, y) => (mode === 'score' ? y.score - x.score : x.name.localeCompare(y.name, 'zh-Hans-CN'))));
  };

  const snippet = useMemo(
    () =>
      [
        `import autoAnimate from '@formkit/auto-animate';`,
        `import { useAutoAnimate } from '@formkit/auto-animate/react';`,
        ``,
        `// React：hook 返回 [ref, (enabled) => void]`,
        `const [listRef, enableList] = useAutoAnimate<HTMLDivElement>({`,
        `  duration: 260,`,
        `  easing: 'ease-in-out',`,
        `});`,
        `return <div ref={listRef}>{items.map(i => <Card key={i.id} />)}</div>;`,
        ``,
        `// 任意框架 / 原生 DOM：命令式 API，返回一个可以 disable 的控制器`,
        `const controller = autoAnimate(gridEl, { duration: 320 });`,
        `// ...`,
        `controller.disable();`,
        ``,
        `// 关键：key 必须稳定。auto-animate 靠 key 认节点，靠布局差算 FLIP。`,
        `// 加 / 删 / 排序 / 过滤 全都不用自己写任何过渡。`,
      ].join('\n'),
    [],
  );

  return (
    <Lab
      title="auto-animate 自动补间"
      badge={<span className="demo-live-badge">@formkit/auto-animate 0.8</span>}
      reset={() => {
        setItems(seedItems());
        setFilter('all');
        setSortMode('none');
        setNextId(NAMES.length + 1);
        setAnimationsOn(true);
        enableList(true);
        setTiles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }}
    >
      <div className="lab-layout">
        <div className="lab-controls">
          <Select<GroupFilter>
            label="过滤分组"
            value={filter}
            options={[['all', '全部'], ...GROUPS.map((g) => [g, g] as const)]}
            onChange={setFilter}
          />
          <Segmented<'none' | 'score' | 'name'>
            label="排序方式"
            value={sortMode}
            options={[
              ['none', '不排序'],
              ['score', '按分值'],
              ['name', '按名称'],
            ]}
            onChange={setSortMode}
          />
          <div className="lab-options">
            <button type="button" className="button button--primary button--small" onClick={add}>
              添加一项
            </button>
            <button type="button" className="button button--secondary button--small" onClick={removeLast}>
              删除末项
            </button>
            <button type="button" className="button button--secondary button--small" onClick={shuffle}>
              随机重排
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => sort('score')}>
              按分值排序
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => sort('name')}>
              按名称排序
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const next = !animationsOn;
                setAnimationsOn(next);
                enableList(next);
              }}
              aria-pressed={animationsOn}
            >
              {animationsOn ? '关闭过渡' : '开启过渡'}
            </button>
          </div>
          <Stats>
            <Stat label="数据条数" value={items.length} />
            <Stat label="可见卡片" value={visible.length} />
          </Stats>
          <p className="lab-motion-note">切到某个分组会一次性移除大半节点，剩下的会补位 —— 这正是 auto-animate 计算 FLIP 的场景。</p>
          {!motionOk ? <Status>系统开启了「减少动态效果」，过渡时长已设为 0；DOM 变更照常发生。</Status> : null}
        </div>

        <div className="lab-stage">
          <div className="lab-auto-list" ref={listRef}>
            {visible.map((item) => (
              <article className="lab-auto-item" key={item.id}>
                <strong>{item.name}</strong>
                <small>
                  {item.group} · {item.score} 分
                </small>
              </article>
            ))}
          </div>

          <p className="lab-motion-note" style={{ marginTop: 18 }}>
            下面这组用的是命令式 <code>autoAnimate(el, options)</code>：
          </p>
          <div className="lab-auto-list" ref={gridRef}>
            {tiles.map((t) => (
              <article className="lab-auto-item" key={t} style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </article>
            ))}
          </div>
          <div className="lab-options">
            <button type="button" className="button button--secondary button--small" onClick={() => setTiles((p) => p.slice().reverse())}>
              反转顺序
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => setTiles((p) => [...p.slice(1), p[0] ?? 1])}>
              轮转
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => setTiles((p) => p.filter((_, i) => i % 2 === 0))}>
              去掉一半
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => setTiles([1, 2, 3, 4, 5, 6, 7, 8, 9])}>
              恢复
            </button>
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="auto-animate 调用" maxHeight={300} />
    </Lab>
  );
}
