import { IS_TOY } from '../../lib/runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Segmented, Status, useDebounced, useStableId, useThemeColors } from '../lab-kit';

const MERMAID_VERSION = '12.2.0';
type SampleKey = 'flow' | 'sequence' | 'class' | 'broken';

const SAMPLES: Record<SampleKey, string> = {
  flow: [
    'flowchart TD',
    '  A[提交订单] --> B{库存校验}',
    '  B -->|充足| C[扣减库存]',
    '  B -->|不足| D[通知补货]',
    '  C --> E[生成支付单]',
    '  E --> F{支付结果}',
    '  F -->|成功| G[出库]',
    '  F -->|超时| H[关闭订单]',
  ].join('\n'),
  sequence: [
    'sequenceDiagram',
    '  participant U as 用户',
    '  participant G as API 网关',
    '  participant O as 订单服务',
    '  participant P as 支付服务',
    '  U->>G: POST /orders',
    '  G->>O: 创建订单',
    '  O->>P: 预授权',
    '  P-->>O: 授权成功',
    '  O-->>G: 订单号',
    '  G-->>U: 201 Created',
  ].join('\n'),
  class: [
    'classDiagram',
    '  direction LR',
    '  class Order {',
    '    +String id',
    '    +String status',
    '    +BigDecimal total()',
    '    +cancel()',
    '  }',
    '  class Payment {',
    '    +String id',
    '    +refund()',
    '  }',
    '  class Customer {',
    '    +String name',
    '  }',
    '  Customer "1" --> "*" Order : 下单',
    '  Order "1" *-- "1..*" Payment : 支付单',
  ].join('\n'),
  broken: ['flowchart TD', '  A[订单节点] -- B[支付节点]', '  C(悬空)'].join('\n'),
};

const SAMPLE_OPTIONS: readonly (readonly [SampleKey, string])[] = [
  ['flow', '流程图'],
  ['sequence', '时序图'],
  ['class', '类图'],
  ['broken', '故意写错'],
];

/** securityLevel: 'strict' means mermaid never evaluates visitor text. */
function looksUnsafe(svg: string): boolean {
  return /<script|javascript:|onload\s*=|onerror\s*=/i.test(svg);
}

/**
 * Mermaid 12: text in, diagram out. `initialize()` is async in v12, so the demo
 * shows a real loading state; invalid syntax surfaces mermaid's own parse error.
 */
export default function MermaidLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const outputRef = useRef<HTMLDivElement>(null);
  const renderId = useStableId('mmd');
  const renderSequence = useRef(0);
  const [sample, setSample] = useState<SampleKey>('flow');
  const [text, setText] = useState(SAMPLES.flow);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const debounced = useDebounced(text, 420);

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';

  useEffect(() => {
    let cancelled = false;
    // mermaid 12 initialisation is async at runtime even though the shipped
    // typings still declare `void`, so we await it defensively.
    const boot = async () => {
      try {
        await mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default',
          fontFamily: 'inherit',
        });
      } catch (cause) {
        if (!cancelled) setError(`mermaid.initialize() 失败：${cause instanceof Error ? cause.message : String(cause)}`);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = outputRef.current;
    if (!host) return;
    let cancelled = false;

    // Mermaid parks a temporary <div id="d…"> in <body> when it throws; clean it.
    const currentRenderId = `${renderId}-${++renderSequence.current}`;
    const clearTemp = () => {
      document.getElementById(`d${currentRenderId}`)?.remove();
      document.getElementById(currentRenderId)?.remove();
    };

    const run = async () => {
      setState('loading');
      clearTemp();
      host.replaceChildren();
      try {
        const result = await mermaid.render(currentRenderId, debounced);
        if (cancelled) {
          clearTemp();
          return;
        }
        if (looksUnsafe(result.svg)) {
          setError('渲染结果包含脚本或事件属性，已按安全策略拒绝插入。');
          setState('idle');
          clearTemp();
          return;
        }
        host.innerHTML = result.svg;
        result.bindFunctions?.(host);
        setError(null);
        setState('ready');
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
        setState('idle');
        clearTemp();
      }
    };

    void run();
    return () => {
      cancelled = true;
      clearTemp();
    };
  }, [debounced, renderId]);

  const pick = (key: SampleKey) => {
    setSample(key);
    setText(SAMPLES[key]);
  };

  const snippet = useMemo(
    () =>
      [
        `await mermaid.initialize({`,
        `  startOnLoad: false,`,
        `  securityLevel: 'strict',   // 不执行任何访客文本`,
        `  theme: 'default',`,
        `});`,
        ``,
        `const { svg, bindFunctions } = await mermaid.render('${renderId}', text);`,
        `host.innerHTML = svg;`,
        `bindFunctions?.(host);`,
        ``,
        `// 出错时 mermaid 抛出真实解析信息，并在 body 里留下临时节点`,
        `try { ... } catch (err) { document.getElementById('d${renderId}')?.remove(); }`,
      ].join('\n'),
    [renderId],
  );

  return (
    <Lab title="Mermaid 文本转图形" badge={<span className="demo-live-badge">Mermaid {MERMAID_VERSION}</span>} reset={() => pick('flow')}>
      <LabLayout
        layout="editor"
        controls={
          <>
            <Segmented<SampleKey> label="示例图" value={sample} options={SAMPLE_OPTIONS} onChange={pick} />
            <label className="lab-field">
              <span>Mermaid 源码</span>
              <textarea
                className="lab-editor lab-editor--short"
                wrap={IS_TOY ? 'off' : undefined}
                rows={12}
                value={text}
                spellCheck={false}
                aria-label="Mermaid 源码编辑器"
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            <Status tone={state === 'ready' ? 'ok' : undefined}>
              {state === 'loading' ? '正在调用 mermaid.render()…' : state === 'ready' ? '渲染完成。' : '等待渲染。'}
              文本长度 {debounced.length} 字符。
            </Status>
          </>
        }
      >
        {error ? <ErrorNote onRetry={() => setText(debounced)}>Mermaid 解析失败：{error}</ErrorNote> : null}
        <div
          className="lab-mermaid-out"
          ref={outputRef}
          style={{ background: surface, color: ink }}
          role="img"
          aria-label="Mermaid 渲染结果"
        />
        <p className="lab-mermaid-note" style={{ color: muted }}>
          当前 <code>securityLevel: 'strict'</code>：Mermaid 只会解析文本并对输出做实体编码，不会执行访客输入，
          也不会把任何外部脚本注入页面。渲染后再做一次脚本/事件属性白名单检查才写入 DOM。
        </p>
        <p className="lab-mermaid-note" style={{ color: muted, borderColor: accent }}>
          试试把箭头写成 <code>A -- B</code>（少了 <code>&gt;</code>），错误信息就是 Mermaid 自己的解析结果，没有被包装。
        </p>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        <Code text={text} onCopy={onCopy} label="Mermaid 源码" />
      </div>
      <div style={{ marginTop: 18, background: soft, borderRadius: 12, padding: '14px 16px' }}>
        <Code text={snippet} onCopy={onCopy} label="Mermaid 调用" />
      </div>
    </Lab>
  );
}
