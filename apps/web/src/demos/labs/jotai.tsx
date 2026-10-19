import { useMemo, useState } from 'react';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage, selectAtom } from 'jotai/utils';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Status, TextField, useThemeColors } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * A real derived-atom graph.
 *
 *   itemsAtom ─┬─> filteredAtom ─> topThreeAtom   (selectAtom)
 *              └─> statsAtom   <─ doneAtom         (atomWithStorage)
 *   searchAtom ─┘
 *   categoryAtom ┘
 *   addItemAtom / toggleDoneAtom / resetGraphAtom  — write-only action atoms
 * ------------------------------------------------------------------ */

type Category = '全部' | '工具' | '组件' | '文档' | '服务';

export interface Todo {
  id: string;
  title: string;
  category: Exclude<Category, '全部'>;
  owner: string;
  minutes: number;
}

const CATEGORIES: readonly Category[] = ['全部', '工具', '组件', '文档', '服务'];

const SEED: Todo[] = [
  { id: 't-1', title: '重构 select 依赖链', category: '工具', owner: '林岚', minutes: 90 },
  { id: 't-2', title: '为 Tabs 补齐键盘回环', category: '组件', owner: '周叙', minutes: 45 },
  { id: 't-3', title: '整理组件库使用文档', category: '文档', owner: '陈默', minutes: 120 },
  { id: 't-4', title: '接入错误上报端点', category: '服务', owner: '林岚', minutes: 60 },
  { id: 't-5', title: '包体积按需加载', category: '工具', owner: '苏白', minutes: 75 },
  { id: 't-6', title: 'Dialog 焦点陷阱回归', category: '组件', owner: '周叙', minutes: 30 },
  { id: 't-7', title: '迁移旧版设计令牌', category: '文档', owner: '陈默', minutes: 150 },
  { id: 't-8', title: '构建产物分块策略', category: '服务', owner: '苏白', minutes: 100 },
];

/** Real read counters — incremented inside each derived atom's read function. */
const reads: Record<string, number> = { filtered: 0, stats: 0, topThree: 0, visible: 0 };
const resetReads = () => {
  reads.filtered = 0;
  reads.stats = 0;
  reads.topThree = 0;
  reads.visible = 0;
};

/** localStorage may be unavailable in hardened contexts — fall back to a no-op store. */
function readStorage(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void } {
  try {
    const probe = window.localStorage;
    return {
      getItem: (key) => probe.getItem(key),
      setItem: (key, value) => probe.setItem(key, value),
      removeItem: (key) => probe.removeItem(key),
    };
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}

const doneAtom = atomWithStorage<Record<string, boolean>>(
  'vibe-jotai-lab-done',
  {},
  createJSONStorage<Record<string, boolean>>(() => readStorage()),
  { getOnInit: true },
);

export const itemsAtom = atom<Todo[]>(SEED);
export const searchAtom = atom('');
export const categoryAtom = atom<Category>('全部');

export const filteredAtom = atom((get) => {
  reads.filtered += 1;
  const items = get(itemsAtom);
  const q = get(searchAtom).trim().toLowerCase();
  const category = get(categoryAtom);
  return items.filter((item) => {
    const hitCategory = category === '全部' || item.category === category;
    const hitText =
      q === '' ||
      item.title.toLowerCase().includes(q) ||
      item.owner.toLowerCase().includes(q);
    return hitCategory && hitText;
  });
});

export const statsAtom = atom((get) => {
  reads.stats += 1;
  const items = get(itemsAtom);
  const done = get(doneAtom);
  const finished = items.filter((i) => done[i.id]).length;
  const minutes = items.reduce((n, i) => n + (done[i.id] ? 0 : i.minutes), 0);
  return { total: items.length, finished, pending: items.length - finished, minutes };
});

/** selectAtom derives a cheap projection off an already-derived atom. */
export const topThreeAtom = selectAtom(filteredAtom, (list) => {
  reads.topThree += 1;
  return list.slice(0, 3);
});

/* ---- write-only action atoms ---- */
export const addItemAtom = atom(null, (get, set, input: { title: string; category: Exclude<Category, '全部'>; owner: string; minutes: number }) => {
  const trimmed = input.title.trim();
  if (trimmed === '') return false;
  const next: Todo = {
    id: `t-${Date.now().toString(36)}-${get(itemsAtom).length}`,
    title: trimmed,
    category: input.category,
    owner: input.owner.trim() || '未指派',
    minutes: Number.isFinite(input.minutes) ? Math.max(0, Math.round(input.minutes)) : 0,
  };
  set(itemsAtom, (prev) => [next, ...prev]);
  return true;
});

export const toggleDoneAtom = atom(null, (get, set, id: string) => {
  const done = get(doneAtom);
  set(doneAtom, { ...done, [id]: !done[id] });
});

export const resetGraphAtom = atom(null, (_get, set) => {
  set(itemsAtom, SEED);
  set(searchAtom, '');
  set(categoryAtom, '全部');
  set(doneAtom, {});
});

interface LogEntry {
  id: number;
  atom: string;
  detail: string;
}

export default function JotaiLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const filtered = useAtomValue(filteredAtom);
  const stats = useAtomValue(statsAtom);
  const topThree = useAtomValue(topThreeAtom);
  const done = useAtomValue(doneAtom);
  const search = useAtomValue(searchAtom);
  const [category, setCategory] = useAtom(categoryAtom);
  const setSearch = useSetAtom(searchAtom);
  const addItem = useSetAtom(addItemAtom);
  const toggleDone = useSetAtom(toggleDoneAtom);
  const resetGraph = useSetAtom(resetGraphAtom);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftMinutes, setDraftMinutes] = useState('30');

  const push = (atomName: string, detail: string) =>
    setLog((prev) => [{ id: prev.length + 1, atom: atomName, detail }, ...prev].slice(0, 24));

  const reset = () => {
    resetGraph();
    resetReads();
    setDraft('');
    setDraftOwner('');
    setDraftMinutes('30');
    setLog([]);
  };

  const snippet = useMemo(
    () =>
      [
        `export const filteredAtom = atom((get) => {`,
        `  const items  = get(itemsAtom);      // 基础原子`,
        `  const q      = get(searchAtom);     // 基础原子`,
        `  const cat    = get(categoryAtom);   // 基础原子`,
        `  return items.filter(/* 真正的派生 */);`,
        `});`,
        ``,
        `// 派生之上再派生：selectAtom 做切片`,
        `export const topThreeAtom = selectAtom(filteredAtom, (list) => list.slice(0, 3));`,
        ``,
        `// 只写原子：没有 read，只有 write，调用方不需要订阅任何状态`,
        `export const addItemAtom = atom(null, (get, set, input) => {`,
        `  set(itemsAtom, (prev) => [next, ...prev]);`,
        `});`,
        `const addItem = useSetAtom(addItemAtom);`,
        ``,
        `// 持久化基础原子`,
        `const doneAtom = atomWithStorage('vibe-jotai-lab-done', {}, storage, { getOnInit: true });`,
      ].join('\n'),
    [],
  );

  return (
    <Lab title="Jotai：原子图与派生传播" badge={<span className="demo-live-badge">Jotai 2</span>} reset={reset}>
      <div className="lab-layout">
        <div className="lab-controls">
          <p className="demo-caption">
            上游任何基础原子变化，Jotai 会沿依赖图只重算受影响的派生原子；下方「读次数」是真实计数。
          </p>
          <TextField label="搜索（写入 searchAtom）" value={search} onChange={setSearch} placeholder="搜索标题或负责人…" />
          <div className="lab-field">
            <span>分类（写入 categoryAtom）</span>
            <div className="segmented" role="group" aria-label="分类">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={c === category ? 'is-active' : ''} aria-pressed={c === category} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Status tone={stats.pending === 0 && stats.total > 0 ? 'ok' : undefined}>
            filteredAtom 当前产出 {filtered.length} 条；statsAtom 依赖 itemsAtom + doneAtom。
          </Status>
          <div className="lab-jotai-new">
            <TextField label="新增标题（addItemAtom 的输入）" value={draft} onChange={setDraft} placeholder="写点什么…" />
            <TextField label="负责人" value={draftOwner} onChange={setDraftOwner} placeholder="谁来做" />
            <TextField label="预估分钟" value={draftMinutes} onChange={setDraftMinutes} />
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => {
                const ok = addItem({
                  title: draft,
                  owner: draftOwner,
                  minutes: Number(draftMinutes),
                  category: category === '全部' ? '工具' : category,
                });
                push('addItemAtom', ok ? '已写入 itemsAtom' : '标题为空，写入被拒绝');
                if (ok) {
                  setDraft('');
                  setDraftOwner('');
                }
              }}
            >
              写入 itemsAtom
            </button>
          </div>
        </div>

        <div className="lab-stage">
          <div className="lab-jotai-graph" aria-label="派生原子依赖图">
            <div className="lab-jotai-node" data-kind="base">itemsAtom · searchAtom · categoryAtom · doneAtom(持久化)</div>
            <div className="lab-jotai-arrow" aria-hidden="true">↓ get()</div>
            <div className="lab-jotai-node" data-kind="derived">
              filteredAtom · 读 {reads.filtered} 次 · 产出 {filtered.length} 条
            </div>
            <div className="lab-jotai-arrow" aria-hidden="true">↓ selectAtom</div>
            <div className="lab-jotai-node" data-kind="select">
              topThreeAtom · 读 {reads.topThree} 次 · 产出 {topThree.length} 条
            </div>
            <div className="lab-jotai-arrow" aria-hidden="true">↓ 并行派生</div>
            <div className="lab-jotai-node" data-kind="derived">
              statsAtom · 读 {reads.stats} 次 · 待办 {stats.pending} / {stats.total} · 剩余 {stats.minutes} 分钟
            </div>
          </div>

          <div className="lab-jotai-columns">
            <section className="lab-jotai-panel" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
              <header>
                <strong>filteredAtom → useAtomValue</strong>
                <span>{filtered.length} 条</span>
              </header>
              {filtered.length === 0 ? (
                <p className="lab-jotai-empty">没有匹配项。派生原子返回空数组，UI 正常降级。</p>
              ) : (
                <ul>
                  {filtered.map((item) => (
                    <li key={item.id}>
                      <label className="lab-option">
                        <input
                          type="checkbox"
                          checked={Boolean(done[item.id])}
                          onChange={() => {
                            toggleDone(item.id);
                            push('toggleDoneAtom', `${item.title} → ${done[item.id] ? '未完成' : '已完成'}`);
                          }}
                        />
                        <span className={done[item.id] ? 'lab-jotai-done' : undefined}>{item.title}</span>
                      </label>
                      <small>{item.category} · {item.owner} · {item.minutes} 分钟</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lab-jotai-panel" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
              <header>
                <strong>topThreeAtom → selectAtom</strong>
                <span>{topThree.length} 条</span>
              </header>
              <ol>
                {topThree.map((item, i) => (
                  <li key={item.id}>
                    {i + 1}. {item.title}
                  </li>
                ))}
              </ol>
              <p className="lab-jotai-hint">
                doneAtom 来自 atomWithStorage，勾选后会写入 localStorage 的 <code>vibe-jotai-lab-done</code>。
              </p>
            </section>
          </div>

          <div className="lab-jotai-log">
            <div className="lab-jotai-log__head">
              <span>只写原子的调用记录</span>
              <span>最新在上</span>
            </div>
            {log.length === 0 ? (
              <p className="lab-jotai-empty">写入 itemsAtom 或勾选完成项后，这里会出现记录。</p>
            ) : (
              <ul className="lab-event-log" style={{ marginTop: 0 }}>
                {log.map((entry) => (
                  <li key={entry.id}>
                    <code style={{ color: colors.accent }}>{entry.atom}</code>
                    <span style={{ color: colors.muted }}>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Jotai 调用" />
    </Lab>
  );
}
