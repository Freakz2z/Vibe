import { LabControls } from '../lab-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { useShallow } from 'zustand/react/shallow';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Stats, Stat, Status, TextField, useThemeColors } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * Real store: create() + subscribeWithSelector()
 * Every panel below reads through its own selector, so the render
 * counters are a direct measurement of "which slice re-rendered".
 * ------------------------------------------------------------------ */

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Line {
  id: string;
  qty: number;
}

export interface CartState {
  lines: Line[];
  coupon: string | null;
  /** Free shipping threshold, in yuan. */
  freeAbove: number;
  add: (product: Product) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  applyCoupon: (code: string) => void;
  reset: () => void;
}

const CATALOG: readonly Product[] = [
  { id: 'p-1', name: '机械键盘 · 静电容 68 键', price: 599 },
  { id: 'p-2', name: '人体工学椅 · 网面', price: 1480 },
  { id: 'p-3', name: '27 寸 4K 显示器', price: 2199 },
  { id: 'p-4', name: '降噪耳机 · 头戴式', price: 1299 },
  { id: 'p-5', name: '桌面支架 · 双屏', price: 349 },
  { id: 'p-6', name: '行走的硬盘 · 2TB', price: 899 },
];

const COUPONS: Record<string, number> = { VIBE10: 0.9, LAB20: 0.8 };

const useCartStore = create<CartState>()(
  subscribeWithSelector((set) => ({
    lines: [],
    coupon: null,
    freeAbove: 3000,
    add: (product) =>
      set((state) => {
        const found = state.lines.find((l) => l.id === product.id);
        if (found) {
          return {
            lines: state.lines.map((l) => (l.id === product.id ? { ...l, qty: l.qty + 1 } : l)),
          };
        }
        return { lines: [...state.lines, { id: product.id, qty: 1 }] };
      }),
    setQty: (id, qty) =>
      set((state) => ({
        lines: state.lines.map((l) => (l.id === id ? { ...l, qty: Math.max(0, qty) } : l)),
      })),
    remove: (id) => set((state) => ({ lines: state.lines.filter((l) => l.id !== id) })),
    applyCoupon: (code) => set({ coupon: code.trim() || null }),
    reset: () => set({ lines: [], coupon: null }),
  })),
);

/* Real derived selectors — each one is its own subscription boundary.
 * They must return a STABLE reference (primitive, or an array/object whose
 * members are themselves stable), otherwise `useSyncExternalStore` sees a new
 * snapshot on every read and re-renders forever. Anything derived is computed
 * outside the selector, with `useMemo`/`useShallow`. */
const selectQtyTotal = (s: CartState) => s.lines.reduce((n, l) => n + l.qty, 0);
const selectLines = (s: CartState) => s.lines;
const priceLines = (lines: readonly Line[]) =>
  lines.map((l) => ({ ...l, ...(CATALOG.find((p) => p.id === l.id) ?? { name: '未知商品', price: 0 }) }));
/** Stable tuple of store slices — safe for `subscribe` + `useShallow`. */
const selectTotalInput = (s: CartState) => [s.lines, s.coupon, s.freeAbove] as const;

function computeTotal(lines: readonly Line[], coupon: string | null, freeAbove: number) {
  const subtotal = priceLines(lines).reduce((n, l) => n + l.price * l.qty, 0);
  const rate = coupon ? (COUPONS[coupon.toUpperCase()] ?? 1) : 1;
  const discounted = Math.round(subtotal * rate * 100) / 100;
  const shipping = discounted === 0 || discounted >= freeAbove ? 0 : 20;
  return { discounted, shipping, grand: discounted + shipping, coupon, freeAbove };
}

/* ------------------------------------------------------------------ *
 * Render ledger — plain module state, bumped during render so the
 * number printed IS the number of times that component has rendered.
 * ------------------------------------------------------------------ */
interface Ledger {
  list: number;
  badge: number;
  total: number;
}

const ledger: Ledger = { list: 0, badge: 0, total: 0 };
const resetLedger = () => {
  ledger.list = 0;
  ledger.badge = 0;
  ledger.total = 0;
};

const fmt = (n: number) => `¥${n.toFixed(2)}`;

interface LogEntry {
  id: number;
  selector: string;
  from: string;
  to: string;
}

export default function ZustandLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [nonce, setNonce] = useState(0);
  const logId = useRef(0);
  const [draftCoupon, setDraftCoupon] = useState('VIBE10');

  const push = useCallback((selector: string, from: unknown, to: unknown) => {
    logId.current += 1;
    const id = logId.current;
    setLog((prev) =>
      [{ id, selector, from: String(from), to: String(to) }, ...prev].slice(0, 40),
    );
  }, []);

  /* subscribeWithSelector: one fire-and-forget subscription per slice.
   * Derived slices go through a stable tuple + shallow equality, so the
   * listener really only fires when the value it watches actually changes. */
  useEffect(() => {
    const unsubs = [
      useCartStore.subscribe(selectQtyTotal, (qty, prevQty) => push('qtyTotal', prevQty, qty)),
      useCartStore.subscribe(selectLines, (lines, prevLines) => push('lines', `${prevLines.length} 行`, `${lines.length} 行`)),
      useCartStore.subscribe(
        selectTotalInput,
        ([lines, coupon, freeAbove], [prevLines, prevCoupon, prevFreeAbove]) =>
          push(
            'grandTotal',
            fmt(computeTotal(prevLines, prevCoupon, prevFreeAbove).grand),
            fmt(computeTotal(lines, coupon, freeAbove).grand),
          ),
        { equalityFn: shallow },
      ),
      useCartStore.subscribe(
        (s: CartState) => s.coupon,
        (coupon, prev) => push('coupon', prev ?? 'null', coupon ?? 'null'),
      ),
      // A plain whole-state subscription: fires on every setState().
      useCartStore.subscribe((s: CartState) => s, () => push('整棵树 (state)', '变更前', '变更后')),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [push]);

  const reset = () => {
    useCartStore.getState().reset();
    resetLedger();
    logId.current = 0;
    setLog([]);
    setDraftCoupon('VIBE10');
    setNonce((n) => n + 1);
  };

  const snippet = useMemo(
    () =>
      [
        `const useCartStore = create<CartState>()(`,
        `  subscribeWithSelector((set) => ({`,
        `    lines: [], coupon: null,`,
        `    add: (product) => set((state) => ({ ... })),`,
        `    reset: () => set({ lines: [], coupon: null }),`,
        `  })),`,
        `);`,
        ``,
        `// 三个面板各自订阅自己的切片，互不牵连`,
        `// selector 必须返回稳定引用：原始切片直接订阅，派生值放 useMemo/useShallow 外面算`,
        `const lines = useCartStore((s) => s.lines);`,
        `const priced = useMemo(() => priceLines(lines), [lines]);`,
        `const qty   = useCartStore((s) => s.lines.reduce((n, l) => n + l.qty, 0));`,
        `const [ls, coupon] = useCartStore(useShallow((s) => [s.lines, s.coupon]));`,
        ``,
        `// 本 demo 的核心：带 selector 的 store.subscribe`,
        `useCartStore.subscribe(selectQtyTotal, (next, prev) => log(next, prev));`,
        `useCartStore.subscribe(selectInput, listener, { equalityFn: shallow });`,
        `// 清理：${'<每个 unsubscribe 都在 useEffect 清理里调用>'}`,
      ].join('\n'),
    [],
  );

  const lineColor = colors['line-strong'] ?? '#ccc';
  const accentColor = colors.accent ?? '#d95a3f';

  return (
    <Lab title="Zustand：细粒度订阅与带 selector 的监听" badge={<span className="demo-live-badge">Zustand 5</span>} reset={reset}>
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <p className="demo-caption">
            三个面板各自只订阅一个切片：只有被改动的切片所在的面板才会重渲染，右侧「渲染计数」是真实计数。
          </p>
          <div className="lab-options">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => useCartStore.getState().add(CATALOG[Math.floor(Math.random() * CATALOG.length)])}
            >
              随机加一件
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const first = useCartStore.getState().lines[0];
                if (!first) return;
                useCartStore.getState().setQty(first.id, first.qty + 1);
              }}
            >
              首行数量 +1
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const lines = useCartStore.getState().lines;
                const last = lines[lines.length - 1];
                if (last) useCartStore.getState().remove(last.id);
              }}
            >
              删除末行
            </button>
          </div>
          <TextField
            label="优惠券（真实查表：VIBE10 九折，LAB20 八折）"
            value={draftCoupon}
            onChange={setDraftCoupon}
            mono
          />
          <div className="lab-options">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => useCartStore.getState().applyCoupon(draftCoupon)}
            >
              写入 store.coupon
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => useCartStore.getState().applyCoupon('')}
            >
              清空 coupon
            </button>
          </div>
          <Status tone={log.length > 0 ? 'ok' : undefined}>
            subscribeWithSelector 已注册 5 个监听，清理时逐一 unsubscribe。
          </Status>
        </LabControls>

        <div className="lab-stage">
          <Stats>
            <Stat label="列表面板渲染" value={ledger.list} />
            <Stat label="件数面板渲染" value={ledger.badge} />
            <Stat label="结算面板渲染" value={ledger.total} />
          </Stats>
          <div className="lab-zustand-panels" data-nonce={nonce}>
            <CartList />
            <CartBadge />
            <CartTotal />
          </div>
          <div className="lab-zustand-log">
            <div className="lab-zustand-log__head">
              <span>store.subscribe(selector, listener) 实际触发顺序</span>
              <span>最新在上 · 共 {log.length} 条</span>
            </div>
            {log.length === 0 ? (
              <p className="lab-zustand-log__empty">还没有触发记录，点击左侧任意按钮。</p>
            ) : (
              <ul className="lab-event-log" style={{ marginTop: 0 }}>
                {log.map((entry) => (
                  <li key={entry.id}>
                    <code style={{ color: accentColor }}>{entry.selector}</code>
                    <span style={{ color: colors.muted }}>
                      {entry.from} → {entry.to}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="lab-zustand-note" style={{ borderColor: lineColor }}>
            说明：同一个 selector 的 listener 只在该切片「值真正变化」时才触发；整棵树监听则会每次 setState 都触发。
          </p>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Zustand 调用" />
    </Lab>
  );
}

function CartList() {
  ledger.list += 1;
  // 订阅切片本身（引用稳定）；派生出来的「带价格行」放在 useMemo 里算。
  const lines = useCartStore(selectLines);
  const priced = useMemo(() => priceLines(lines), [lines]);
  const colors = useThemeColors();

  return (
    <section className="lab-zustand-panel" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
      <header>
        <strong>购物清单</strong>
        <span>订阅 lines · 渲染 {ledger.list} 次</span>
      </header>
      {priced.length === 0 ? (
        <p className="lab-zustand-log__empty">清单为空。</p>
      ) : (
        <ul>
          {priced.map((l) => (
            <li key={l.id}>
              <span className="lab-zustand-panel__name">{l.name}</span>
              <span className="lab-zustand-panel__meta">
                ×{l.qty} · {fmt(l.price * l.qty)}
              </span>
              <button
                type="button"
                className="lab-zustand-step"
                aria-label={`减少 ${l.name} 的数量`}
                onClick={() => useCartStore.getState().setQty(l.id, l.qty - 1)}
              >
                −
              </button>
              <button
                type="button"
                className="lab-zustand-step"
                aria-label={`增加 ${l.name} 的数量`}
                onClick={() => useCartStore.getState().setQty(l.id, l.qty + 1)}
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CartBadge() {
  ledger.badge += 1;
  const qty = useCartStore(selectQtyTotal);

  return (
    <section className="lab-zustand-panel lab-zustand-panel--badge">
      <header>
        <strong>件数徽标</strong>
        <span>订阅 qtyTotal · 渲染 {ledger.badge} 次</span>
      </header>
      <p className="lab-metric" style={{ color: 'var(--accent)' }}>
        {qty}
      </p>
      <p className="lab-zustand-panel__hint">只在件数变化时重渲染；增删行不会触发这里。</p>
    </section>
  );
}

function CartTotal() {
  ledger.total += 1;
  // useShallow 对这个元组做浅比较：切片没变时快照引用保持不变。
  const [lines, coupon, freeAbove] = useCartStore(useShallow(selectTotalInput));
  const total = useMemo(() => computeTotal(lines, coupon, freeAbove), [lines, coupon, freeAbove]);
  const colors = useThemeColors();

  return (
    <section className="lab-zustand-panel" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
      <header>
        <strong>结算汇总</strong>
        <span>订阅 grandTotal · 渲染 {ledger.total} 次</span>
      </header>
      <dl className="lab-zustand-sum">
        <div>
          <dt>小计</dt>
          <dd>{fmt(total.discounted)}</dd>
        </div>
        <div>
          <dt>运费（满 {fmt(total.freeAbove)} 免）</dt>
          <dd>{total.shipping === 0 ? '免运费' : fmt(total.shipping)}</dd>
        </div>
        <div>
          <dt>优惠券</dt>
          <dd>{total.coupon ? total.coupon.toUpperCase() : '未使用'}</dd>
        </div>
        <div>
          <dt>应付</dt>
          <dd className="lab-zustand-sum__grand">{fmt(total.grand)}</dd>
        </div>
      </dl>
    </section>
  );
}
