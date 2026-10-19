import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { DemoCopyHandler } from './types';

interface GradientDemoProps {
  onCopy: DemoCopyHandler;
}

const PRESETS = [
  { name: '暖砂', from: '#f4b183', to: '#e86448' },
  { name: '薄暮', from: '#424874', to: '#d6a8a1' },
  { name: '薄荷', from: '#9ed8c3', to: '#236b74' },
  { name: '海盐', from: '#dce8f0', to: '#7da0b8' },
];

export function GradientDemo({ onCopy }: GradientDemoProps) {
  const [from, setFrom] = useState('#f4b183');
  const [to, setTo] = useState('#e86448');
  const [angle, setAngle] = useState(132);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const css = `linear-gradient(${angle}deg, ${from.toUpperCase()} 0%, ${to.toUpperCase()} 100%)`;

  const handleCopy = async () => {
    const success = await onCopy(`background: ${css};`, '渐变 CSS');
    if (!success) return;
    setCopied(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="demo-workspace gradient-demo" aria-label="渐变色原理演示">
      <div className="demo-toolbar">
        <div>
          <span className="demo-live-badge">实时预览</span>
          <h2>调一支属于自己的渐变</h2>
        </div>
        <button
          type="button"
          className="button button--secondary button--small"
          onClick={handleCopy}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? '已复制' : '复制 CSS'}
        </button>
      </div>

      <div className="gradient-layout">
        <div className="gradient-preview" style={{ background: css }}>
          <div className="gradient-preview__label">
            <span>VIBE / {angle}°</span>
            <strong>色彩实验</strong>
          </div>
        </div>

        <div className="gradient-controls">
          <div className="color-controls">
            <label className="color-field">
              <span>起始色</span>
              <span className="color-field__input">
                <input
                  type="color"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  aria-label="选择渐变起始色"
                />
                <code>{from.toUpperCase()}</code>
              </span>
            </label>
            <label className="color-field">
              <span>结束色</span>
              <span className="color-field__input">
                <input
                  type="color"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  aria-label="选择渐变结束色"
                />
                <code>{to.toUpperCase()}</code>
              </span>
            </label>
          </div>

          <label className="range-field" htmlFor="gradient-angle">
            <span>
              角度 <output htmlFor="gradient-angle">{angle}°</output>
            </span>
            <input
              id="gradient-angle"
              type="range"
              min="0"
              max="360"
              step="1"
              value={angle}
              onChange={(event) => setAngle(Number(event.target.value))}
            />
            <small>角度沿顺时针增加，0° 从下往上。</small>
          </label>

          <div>
            <p className="demo-control-label">或从一组颜色开始</p>
            <div className="gradient-presets">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  className="gradient-swatch"
                  aria-label={`使用${preset.name}配色`}
                  onClick={() => {
                    setFrom(preset.from);
                    setTo(preset.to);
                  }}
                >
                  <span
                    style={{ background: `linear-gradient(120deg, ${preset.from}, ${preset.to})` }}
                    aria-hidden="true"
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="gradient-code">
            <code>background: {css};</code>
            <button
              type="button"
              className="gradient-code__copy"
              onClick={handleCopy}
              aria-label="复制渐变 CSS"
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
          </div>

          <p className="demo-caption">
            预览和代码都由页面实时生成。颜色选择器修改的是演示状态，不会写入站点数据。
          </p>
        </div>
      </div>
    </section>
  );
}
