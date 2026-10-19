import { useMemo, useSyncExternalStore } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import {
  configureStore,
  createEntityAdapter,
  createSelector,
  createSlice,
  type Middleware,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Segmented, Status, Stats, Stat, useThemeColors } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * createEntityAdapter keeps { ids, entities } normalised so 40 records
 * can be added / updated / removed without copying the whole table.
 * ------------------------------------------------------------------ */

export type Priority = 'p0' | 'p1' | 'p2';
export type TicketStatus = '待处理' | '进行中' | '已完成';

export interface Ticket {
  id: string;
  title: string;
  region: '华东' | '华北' | '华南' | '西南';
  priority: Priority;
  status: TicketStatus;
  owner: string;
  score: number;
}

const REGIONS = ['华东', '华北', '华南', '西南'] as const;
const OWNERS = ['林岚', '周叙', '陈默', '苏白', '何予'];
const SUBJECTS = [
  '结算页偶发白屏',
  '导出 CSV 中文乱码',
  '登录态在 Safari 丢失',
  '分页参数越界报错',
  '附件上传进度卡住',
  '筛选条件未持久化',
  '移动端表格横向溢出',
  '时区导致日期偏移一天',
  '接口重试导致重复下单',
  '大列表滚动掉帧',
  '暗色主题对比度不足',
  '错误提示未做转义',
];

const SEED_TICKETS: Ticket[] = Array.from({ length: 40 }, (_, i) => ({
  id: `TK-${String(1000 + i)}`,
  title: SUBJECTS[i % SUBJECTS.length],
  region: REGIONS[i % REGIONS.length],
  priority: (['p0', 'p1', 'p2'] as const)[i % 3],
  status: (['待处理', '进行中', '已完成'] as const)[i % 3],
  owner: OWNERS[i % OWNERS.length],
  score: (i * 37) % 100,
}));

const ticketsAdapter = createEntityAdapter<Ticket>({
  // Real sort: selectAll() always comes back ordered by score, desc.
  sortComparer: (a, b) => b.score - a.score || a.id.localeCompare(b.id),
});

const ticketsSlice = createSlice({
  name: 'tickets',
  initialState: ticketsAdapter.getInitialState({ lastBulk: '初始化 40 条' }),
  reducers: {
    addOne: ticketsAdapter.addOne,
    addMany: ticketsAdapter.addMany,
    updateOne: ticketsAdapter.updateOne,
    upsertOne: ticketsAdapter.upsertOne,
    removeOne: ticketsAdapter.removeOne,
    removeMany: ticketsAdapter.removeMany,
    setAll: ticketsAdapter.setAll,
    noteBulk(state, action: PayloadAction<string>) {
      state.lastBulk = action.payload;
    },
  },
});

const uiSlice = createSlice({
  name: 'ui',
  initialState: { region: '全部' as '全部' | Ticket['region'], notice: 0 },
  reducers: {
    setRegion(state, action: PayloadAction<'全部' | Ticket['region']>) {
      state.region = action.payload;
    },
    /** Touches the ui slice only — used to prove createSelector memoisation. */
    bumpNotice(state) {
      state.notice += 1;
    },
  },
});

/* ---- action log: an external store fed by a real middleware ---- */
interface LogEntry {
  id: number;
  type: string;
  detail: string;
}

let logSeq = 0;
let logEntries: LogEntry[] = [];
let dispatchCount = 0;
const logListeners = new Set<() => void>();

function emitLog(type: string, detail: string) {
  logSeq += 1;
  dispatchCount += 1;
  logEntries = [{ id: logSeq, type, detail }, ...logEntries].slice(0, 30);
  for (const listener of logListeners) listener();
}

function subscribeLog(listener: () => void) {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

function clearLog() {
  logEntries = [];
  dispatchCount = 0;
  logSeq = 0;
  for (const listener of logListeners) listener();
}

const loggerMiddleware: Middleware = () => (next) => (action) => {
  const typed = action as { type?: string; payload?: unknown };
  const payload = typed.payload;
  const detail =
    payload === undefined
      ? '—'
      : typeof payload === 'object'
        ? JSON.stringify(payload).slice(0, 90)
        : String(payload).slice(0, 90);
  emitLog(typed.type ?? '(unknown)', detail);
  return next(action);
};

const store = configureStore({
  reducer: { tickets: ticketsSlice.reducer, ui: uiSlice.reducer },
  middleware: (getDefault) => getDefault().concat(loggerMiddleware),
});

store.dispatch(ticketsSlice.actions.setAll(SEED_TICKETS));
store.dispatch(ticketsSlice.actions.noteBulk('初始化 40 条工单'));
clearLog();

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

const ticketSelectors = ticketsAdapter.getSelectors((state: RootState) => state.tickets);

/* ---- derived selector with real reselect memoisation accounting ---- */
const memoStats = { calls: 0, recomputes: 0 };

const baseBoard = createSelector(
  [ticketSelectors.selectAll, (state: RootState) => state.ui.region],
  (all, region) => {
    memoStats.recomputes += 1;
    const scoped = region === '全部' ? all : all.filter((t) => t.region === region);
    const board: Record<TicketStatus, Ticket[]> = { 待处理: [], 进行中: [], 已完成: [] };
    for (const ticket of scoped) board[ticket.status].push(ticket);
    return {
      rows: scoped.length,
      open: board['待处理'].length,
      doing: board['进行中'].length,
      done: board['已完成'].length,
      weight: scoped.reduce((n, t) => n + t.score, 0),
    };
  },
);

function selectBoard(state: RootState) {
  memoStats.calls += 1;
  return baseBoard(state);
}

/**
 * Probe component: it subscribes to `ui.notice`, which is NOT an input of the
 * memoised selector, so every notice bump re-renders it and calls selectBoard
 * again — while the result function is skipped by reselect's cache.
 */
function MemoProbe() {
  const notice = useSelector((s: RootState) => s.ui.notice);
  const board = selectBoard(store.getState());
  const hit = memoStats.calls - memoStats.recomputes;
  return (
    <div className="lab-rtk-memo">
      <strong>createSelector 记忆化（探针组件实测）</strong>
      <span>
        ui.notice = {notice}；selectBoard 调用 <b>{memoStats.calls}</b> 次，结果函数重算 <b>{memoStats.recomputes}</b> 次，缓存命中{' '}
        <b>{hit}</b> 次。点击「dispatch ui/bumpNotice」会让调用 +1、重算 +0。
      </span>
      <small>
        当前派生结果：{board.rows} 条 / 待处理 {board.open} / 进行中 {board.doing} / 已完成 {board.done} / 权重 {board.weight}
      </small>
    </div>
  );
}

function useActionLog(): LogEntry[] {
  return useSyncExternalStore(subscribeLog, () => logEntries);
}

function useDispatchCount(): number {
  return useSyncExternalStore(subscribeLog, () => dispatchCount);
}

export default function ReduxToolkitLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  return (
    <Provider store={store}>
      <ReduxToolkitInner onCopy={onCopy} />
    </Provider>
  );
}

function ReduxToolkitInner({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const dispatch = useDispatch<AppDispatch>();
  const total = useSelector(ticketSelectors.selectTotal);
  const board = useSelector(baseBoard);
  const region = useSelector((s: RootState) => s.ui.region);
  const all = useSelector(ticketSelectors.selectAll);
  const lastBulk = useSelector((s: RootState) => s.tickets.lastBulk);
  const log = useActionLog();
  const dispatchCount = useDispatchCount();

  const nextIndex = useMemo(() => total + 1000, [total]);

  const snippet = useMemo(
    () =>
      [
        `const ticketsAdapter = createEntityAdapter<Ticket>({`,
        `  sortComparer: (a, b) => b.score - a.score,   // selectAll 自带排序`,
        `});`,
        ``,
        `const ticketsSlice = createSlice({`,
        `  name: 'tickets',`,
        `  initialState: ticketsAdapter.getInitialState(),`,
        `  reducers: {`,
        `    addOne: ticketsAdapter.addOne,`,
        `    addMany: ticketsAdapter.addMany,`,
        `    updateOne: ticketsAdapter.updateOne,`,
        `    upsertOne: ticketsAdapter.upsertOne,`,
        `    removeOne: ticketsAdapter.removeOne,`,
        `    removeMany: ticketsAdapter.removeMany,`,
        `  },`,
        `});`,
        ``,
        `const store = configureStore({ reducer: { tickets: ticketsSlice.reducer, ui: uiSlice.reducer } });`,
        ``,
        `const ticketSelectors = ticketsAdapter.getSelectors((s) => s.tickets);`,
        `ticketSelectors.selectAll(state);      // 已排序`,
        `ticketSelectors.selectTotal(state);`,
        ``,
        `// 派生 + 记忆化：只有输入切片变化才会重算`,
        `const board = createSelector([ticketSelectors.selectAll, (s) => s.ui.region], (all, region) => {/* … */});`,
      ].join('\n'),
    [],
  );

  const line = colors['line-strong'] ?? '#ccc';

  return (
    <Lab
      title="Redux Toolkit：实体适配器与记忆化派生"
      badge={<span className="demo-live-badge">RTK 2.5</span>}
      reset={() => {
        dispatch(ticketsSlice.actions.setAll(SEED_TICKETS));
        dispatch(uiSlice.actions.setRegion('全部'));
        clearLog();
        memoStats.calls = 0;
        memoStats.recomputes = 0;
      }}
    >
      <div className="lab-layout">
        <div className="lab-controls">
          <p className="demo-caption">
            所有按钮都 dispatch 真实 action；右侧日志由中间件在 dispatch 链上记录，顺序即真实顺序。
          </p>
          <div className="lab-options">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() =>
                dispatch(
                  ticketsSlice.actions.addOne({
                    id: `TK-${nextIndex}`,
                    title: SUBJECTS[nextIndex % SUBJECTS.length],
                    region: REGIONS[nextIndex % REGIONS.length],
                    priority: 'p1',
                    status: '待处理',
                    owner: OWNERS[nextIndex % OWNERS.length],
                    score: (nextIndex * 13) % 100,
                  }),
                )
              }
            >
              adapter.addOne
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const payload = Array.from({ length: 5 }, (_, k) => ({
                  id: `TK-${nextIndex + k + 1}`,
                  title: SUBJECTS[(nextIndex + k) % SUBJECTS.length],
                  region: REGIONS[(nextIndex + k) % REGIONS.length] as Ticket['region'],
                  priority: 'p2' as const,
                  status: '待处理' as const,
                  owner: OWNERS[(nextIndex + k) % OWNERS.length],
                  score: (nextIndex + k) % 100,
                }));
                dispatch(ticketsSlice.actions.addMany(payload));
                dispatch(ticketsSlice.actions.noteBulk(`addMany 批量写入 ${payload.length} 条`));
              }}
            >
              adapter.addMany（5 条）
            </button>
          </div>
          <div className="lab-options">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const first = store.getState().tickets.ids[0];
                if (typeof first === 'string') {
                  dispatch(ticketsSlice.actions.updateOne({ id: first, changes: { status: '已完成' } }));
                }
              }}
            >
              adapter.updateOne（首条）
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const state = store.getState();
                const first = state.tickets.ids[0];
                const existing = typeof first === 'string' ? state.tickets.entities[first] : undefined;
                if (existing) dispatch(ticketsSlice.actions.upsertOne({ ...existing, score: 99 }));
              }}
            >
              adapter.upsertOne
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const first = store.getState().tickets.ids[0];
                if (typeof first === 'string') dispatch(ticketsSlice.actions.removeOne(first));
              }}
            >
              adapter.removeOne
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const ids = store.getState().tickets.ids.filter((id) => typeof id === 'string').slice(0, 3);
                if (ids.length > 0) dispatch(ticketsSlice.actions.removeMany(ids));
              }}
            >
              adapter.removeMany（3 条）
            </button>
          </div>
          <div className="lab-options">
            <button type="button" className="button button--secondary button--small" onClick={() => dispatch(uiSlice.actions.bumpNotice())}>
              dispatch(ui/bumpNotice（不改 tickets）
            </button>
          </div>
          <Segmented
            label="派生选择器的地区输入"
            value={region}
            options={[['全部', '全部'], ['华东', '华东'], ['华北', '华北'], ['华南', '华南'], ['西南', '西南']]}
            onChange={(v) => dispatch(uiSlice.actions.setRegion(v as '全部' | Ticket['region']))}
          />
          <Status tone="ok">
            selectTotal = {total}；最近一次批量操作：{lastBulk}
          </Status>
        </div>

        <div className="lab-stage">
          <Stats>
            <Stat label="实体总数" value={total} />
            <Stat label="派生命中行" value={board.rows} />
            <Stat label="累计 dispatch" value={dispatchCount} />
          </Stats>

          <MemoProbe />

          <div className="lab-rtk-board">
            <div>
              <span>待处理</span>
              <strong>{board.open}</strong>
            </div>
            <div>
              <span>进行中</span>
              <strong>{board.doing}</strong>
            </div>
            <div>
              <span>已完成</span>
              <strong>{board.done}</strong>
            </div>
            <div>
              <span>权重合计</span>
              <strong>{board.weight}</strong>
            </div>
          </div>

          <div className="lab-rtk-log">
            <div className="lab-rtk-log__head">
              <span>中间件记录的真实 action（最新在上）</span>
              <span>共 {log.length} 条</span>
            </div>
            {log.length === 0 ? (
              <p className="lab-jotai-empty">还没有 dispatch 记录。</p>
            ) : (
              <ul className="lab-event-log" style={{ marginTop: 0 }}>
                {log.map((entry) => (
                  <li key={entry.id}>
                    <code style={{ color: colors.accent }}>{entry.type}</code>
                    <span style={{ color: colors.muted }}>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lab-rtk-list" style={{ borderColor: line }}>
            <header>
              <strong>ticketSelectors.selectAll()（已按 score 降序）</strong>
              <span>前 12 条 / 共 {total} 条</span>
            </header>
            <ul>
              {all.slice(0, 12).map((t) => (
                <li key={t.id}>
                  <code>{t.id}</code>
                  <span>{t.title}</span>
                  <small>
                    {t.region} · {t.priority} · {t.status} · {t.owner} · score {t.score}
                  </small>
                </li>
              ))}
              {all.length === 0 ? <li className="lab-jotai-empty">实体表已清空。</li> : null}
            </ul>
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="RTK 调用" />
    </Lab>
  );
}
