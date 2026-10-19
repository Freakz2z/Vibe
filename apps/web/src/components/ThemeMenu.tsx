import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';

interface ThemeMenuProps {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const OPTIONS: { value: ThemeMode; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', hint: '温暖纸感', Icon: Sun },
  { value: 'dark', label: '深色', hint: '深墨界面', Icon: Moon },
  { value: 'system', label: '跟随系统', hint: '随设备切换', Icon: Monitor },
];

export function ThemeMenu({ mode, resolved, setMode }: ThemeMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const TriggerIcon = mode === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;

  return (
    <div className="theme-menu" ref={wrapperRef}>
      <button
        type="button"
        ref={triggerRef}
        className="icon-button"
        aria-label="选择显示主题"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <TriggerIcon size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="theme-menu__popover" role="menu" aria-label="显示主题">
          <div className="theme-menu__heading">
            <Palette size={14} aria-hidden="true" />
            显示主题
          </div>
          {OPTIONS.map(({ value, label, hint, Icon }) => (
            <button
              type="button"
              className={`theme-menu__option${mode === value ? ' is-selected' : ''}`}
              role="menuitemradio"
              aria-checked={mode === value}
              key={value}
              onClick={() => {
                setMode(value);
                setOpen(false);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="theme-menu__option-text">
                <span>{label}</span>
                <small>{hint}</small>
              </span>
              {mode === value ? <Check size={15} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
