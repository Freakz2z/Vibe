import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Status, useThemeColors } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * Radix ships behaviour, not styles. This demo makes the behaviour
 * observable: a real focusin listener reports document.activeElement so
 * the focus trap, the roving tabindex and the focus return are all
 * visible as text, not vibes.
 * ------------------------------------------------------------------ */

function describeFocus(): string {
  const el = document.activeElement;
  if (!el || el === document.body) return '（body）';
  const tag = el.tagName.toLowerCase();
  if (el instanceof HTMLElement) {
    const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 18) ?? '';
    return `${tag}「${label || el.id || '(无标签)'}」tabindex=${el.tabIndex}`;
  }
  return tag;
}

interface FocusEvent {
  id: number;
  target: string;
  at: number;
}

export default function RadixLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('account');
  const [checked, setChecked] = useState<boolean | 'indeterminate'>(false);
  const [trail, setTrail] = useState<FocusEvent[]>([]);
  const [currentFocus, setCurrentFocus] = useState('（尚未聚焦）');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  /* Real DOM listener — cleaned up on unmount. */
  useEffect(() => {
    const onFocusIn = () => {
      seq.current += 1;
      const id = seq.current;
      const target = describeFocus();
      setCurrentFocus(target);
      setTrail((prev) => [{ id, target, at: Date.now() }, ...prev].slice(0, 12));
    };
    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, []);

  /* Read the real tabIndex Radix wrote on each trigger (roving tabindex). */
  const tabIndexReport = useTabIndexReport(tabListRef, tab);

  const snippet = `// 对话框：焦点陷阱 + Esc 关闭 + 关闭后焦点回到 Trigger，全部由 Radix 实现
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger ref={triggerRef}>打开设置</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="lab-radix-overlay" />
    <Dialog.Content className="lab-radix-content">
      <Dialog.Title>无样式可访问对话框</Dialog.Title>
      <Dialog.Description>Tab 会被困在这里，Esc 关闭。</Dialog.Description>
      <Dialog.Close asChild><button>关闭</button></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

// 标签页：roving tabindex + 方向键，只有激活项 tabindex=0
<Tabs.Root value={tab} onValueChange={setTab}>
  <Tabs.List>
    {items.map((it) => <Tabs.Trigger value={it.value}>{it.label}</Tabs.Trigger>)}
  </Tabs.List>
  <Tabs.Content value="account">…</Tabs.Content>
</Tabs.Root>`;

  const tabItems: { value: string; label: string; body: ReactNode }[] = [
    {
      value: 'account',
      label: '账号',
      body: <p>账号面板：输入框是页面里真实的第一个可聚焦元素。</p>,
    },
    {
      value: 'notify',
      label: '通知',
      body: <p>通知面板：方向键 ← → 在标签之间移动焦点。</p>,
    },
    {
      value: 'danger',
      label: '危险操作',
      body: (
        <p>
          危险操作面板：这是第三个标签，Tab 会回到第一个标签，而不是跑到面板外。
        </p>
      ),
    },
  ];

  return (
    <Lab
      title="Radix UI：无样式可访问原语"
      badge={<span className="demo-live-badge">Radix 1.1</span>}
      reset={() => {
        setOpen(false);
        setTab('account');
        setChecked(false);
        setTrail([]);
      }}
    >
      <div className="lab-layout">
        <div className="lab-controls">
          <p className="demo-caption">
            Radix 不提供任何样式，可访问性行为全部由它注入。下面用真实的 focusin 监听把焦点路径打印出来。
          </p>

          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button type="button" ref={triggerRef} className="button button--primary button--small">
                打开对话框（焦点会被困住）
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="lab-radix-overlay" />
              <Dialog.Content className="lab-radix-content" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
                <Dialog.Title className="lab-radix-title">对话框内的三个可聚焦元素</Dialog.Title>
                <Dialog.Description className="lab-radix-desc">
                  反复按 Tab，焦点在这三个元素之间循环，不会跑到背后的页面上——这是 FocusScope 做的。
                </Dialog.Description>
                <div className="lab-radix-actions">
                  <button type="button" className="lab-radix-field">
                    昵称
                  </button>
                  <button type="button" className="lab-radix-field">
                    时区
                  </button>
                  <button type="button" className="lab-radix-field">
                    删除账号
                  </button>
                </div>
                <div className="lab-radix-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="button button--secondary button--small">
                      关闭（焦点回到触发按钮）
                    </button>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <div className="lab-radix-keys">
            <strong>键盘提示</strong>
            <ul>
              <li>
                <kbd>Esc</kbd> 关闭对话框
              </li>
              <li>
                <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> 在对话框内循环
              </li>
              <li>
                <kbd>←</kbd> <kbd>→</kbd> 切换标签
              </li>
              <li>
                <kbd>Home</kbd> / <kbd>End</kbd> 跳到首尾标签
              </li>
              <li>
                <kbd>Space</kbd> 切换复选框
              </li>
            </ul>
          </div>

          <div className="lab-radix-checks">
            <label className="lab-option">
              <Checkbox.Root
                className="lab-radix-checkbox"
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              >
                <Checkbox.Indicator className="lab-radix-checkbox__indicator">
                  <Check size={14} aria-hidden="true" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <span>按 Space 切换（Checkbox.Root 自己处理键盘）</span>
            </label>
            <label className="lab-option">
              <Checkbox.Root className="lab-radix-checkbox" checked="indeterminate" onCheckedChange={() => undefined}>
                <Checkbox.Indicator className="lab-radix-checkbox__indicator">—</Checkbox.Indicator>
              </Checkbox.Root>
              <span>indeterminate 状态（受控，不响应变更）</span>
            </label>
            <small>当前 checked = {String(checked)}</small>
          </div>
        </div>

        <div className="lab-stage">
          <div className="lab-radix-tabs-wrap">
            <Tabs.Root value={tab} onValueChange={setTab}>
              <Tabs.List className="lab-radix-tablist" aria-label="设置分区" ref={tabListRef}>
                {tabItems.map((item) => (
                  <Tabs.Trigger key={item.value} value={item.value} className="lab-radix-tab">
                    {item.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {tabItems.map((item) => (
                <Tabs.Content key={item.value} value={item.value} className="lab-radix-tabpanel">
                  {item.body}
                  <p className="lab-radix-hint">内容面板仅在激活时挂载（forceMount 未开启）。</p>
                </Tabs.Content>
              ))}
            </Tabs.Root>
            <div className="lab-radix-tabindex">
              <strong>roving tabindex 实测</strong>
              <span>{tabIndexReport}</span>
            </div>
          </div>

          <div className="lab-radix-focus" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
            <div className="lab-radix-focus__head">
              <strong>真实 focus 路径（document.addEventListener('focusin')）</strong>
              <span>最新在上</span>
            </div>
            {trail.length === 0 ? (
              <p className="lab-radix-empty">点按上方按钮，或用 Tab 键在页面里移动焦点。</p>
            ) : (
              <ul className="lab-event-log" style={{ marginTop: 0 }}>
                {trail.map((entry) => (
                  <li key={entry.id}>
                    <code style={{ color: colors.accent }}>{entry.target}</code>
                  </li>
                ))}
              </ul>
            )}
            <div className="lab-radix-now">
              当前焦点：<code>{currentFocus}</code>
            </div>
          </div>

          <Status tone={open ? 'warn' : 'ok'}>
            {open ? '对话框打开中：背景已 inert，Tab 无法逃出。' : '对话框关闭时，焦点会回到 Dialog.Trigger。'}
          </Status>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Radix 调用" />
    </Lab>
  );
}

/** Reads the real DOM tabIndex Radix wrote on every trigger inside the list. */
function useTabIndexReport(listRef: { current: HTMLDivElement | null }, active: string): string {
  const [report, setReport] = useState('（尚未渲染）');
  useEffect(() => {
    const read = () => {
      const list = listRef.current;
      if (!list) return;
      const triggers = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
      const parts = triggers.map((el) => {
        const label = el.textContent?.trim() ?? '';
        return `${label} tabindex=${el.tabIndex}${el.dataset.state === 'active' ? '（选中）' : ''}`;
      });
      setReport(parts.length > 0 ? parts.join(' · ') : '（尚未渲染）');
    };
    read();
    const frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [active, listRef]);
  return report;
}
