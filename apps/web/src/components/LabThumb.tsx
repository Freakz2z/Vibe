

const ACCENT = 'var(--accent)';
const SOFT = 'var(--accent-soft)';
const MUTED = 'var(--muted)';
const SURFACE = 'var(--surface)';
const LINE_STRONG = 'var(--line-strong)';

/**
 * Static, theme-aware SVG mark for each demo stack. Purely decorative
 * (`aria-hidden`); it conveys which real library a demo actually runs.
 */
const ART: Record<string, JSX.Element> = {
  gsap: (
    <>
      <path d="M30 40 H210" stroke={MUTED} strokeDasharray="4 4" />
      <rect x="52" y="70" width="36" height="26" rx="5" fill={SOFT} stroke={ACCENT} />
      <rect x="102" y="52" width="36" height="26" rx="5" fill={SOFT} stroke={ACCENT} />
      <rect x="152" y="34" width="36" height="26" rx="5" fill={ACCENT} />
      <circle cx="182" cy="104" r="7" fill={ACCENT} />
    </>
  ),
  motion: (
    <>
      <rect x="34" y="58" width="62" height="44" rx="10" fill={SOFT} stroke={ACCENT} />
      <rect x="150" y="34" width="56" height="40" rx="10" fill={ACCENT} />
      <path d="M96 80 H138 M128 72 L138 80 L128 88" fill="none" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  'react-spring': (
    <>
      <path d="M30 120 C 70 120, 60 40, 100 40 S 140 120, 178 120" fill="none" stroke={ACCENT} strokeWidth="4" />
      <circle cx="100" cy="40" r="8" fill={ACCENT} />
      <path d="M30 130 H210" stroke={MUTED} strokeDasharray="4 4" />
    </>
  ),
  threejs: (
    <>
      <path d="M120 26 L196 66 L120 106 L44 66 Z" fill="none" stroke={ACCENT} strokeWidth="2.5" />
      <path d="M44 66 V116 L120 156 M196 66 V116 L120 156" fill="none" stroke={MUTED} strokeWidth="2" />
      <circle cx="120" cy="26" r="5" fill={ACCENT} />
      <circle cx="44" cy="116" r="4" fill={MUTED} />
      <circle cx="196" cy="116" r="4" fill={MUTED} />
    </>
  ),
  pixijs: (
    <>
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={i} x={40 + (i % 6) * 28} y={34 + Math.floor(i / 6) * 28} width="20" height="20" rx="3" fill={i % 4 === 0 ? ACCENT : SOFT} />
      ))}
    </>
  ),
  matterjs: (
    <>
      <rect x="40" y="34" width="46" height="46" rx="7" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <rect x="120" y="76" width="46" height="46" rx="7" fill={ACCENT} />
      <rect x="176" y="34" width="30" height="30" rx="6" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <path d="M86 60 L120 92" stroke={MUTED} strokeWidth="2" />
      <path d="M150 120 L166 92" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  paperjs: (
    <>
      <circle cx="98" cy="70" r="38" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <rect x="120" y="52" width="66" height="66" rx="8" fill="none" stroke={ACCENT} strokeWidth="2.5" />
      <path d="M46 122 h148" stroke={MUTED} strokeDasharray="4 4" />
    </>
  ),
  animejs: (
    <>
      <path d="M30 110 C 80 110, 70 40, 120 40 S 170 100, 212 60" fill="none" stroke={ACCENT} strokeWidth="4" />
      <circle cx="120" cy="40" r="6" fill={ACCENT} />
      <circle cx="212" cy="60" r="6" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
    </>
  ),
  'lottie-web': (
    <>
      <circle cx="120" cy="80" r="42" fill="none" stroke={MUTED} strokeDasharray="5 5" />
      <path d="M120 38 L138 92 L102 92 Z" fill={ACCENT} />
    </>
  ),
  swiper: (
    <>
      <rect x="24" y="46" width="70" height="72" rx="9" fill={SURFACE} stroke={MUTED} />
      <rect x="102" y="42" width="76" height="80" rx="9" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <rect x="186" y="46" width="30" height="72" rx="9" fill={SURFACE} stroke={MUTED} />
      <path d="M40 134 L52 128 M200 128 L212 134" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  'embla-carousel': (
    <>
      <rect x="30" y="58" width="52" height="56" rx="8" fill={SURFACE} stroke={MUTED} />
      <rect x="94" y="54" width="52" height="56" rx="8" fill={ACCENT} />
      <rect x="158" y="58" width="52" height="56" rx="8" fill={SURFACE} stroke={MUTED} />
      <path d="M50 130 H190" stroke={SOFT} strokeWidth="6" strokeLinecap="round" />
      <circle cx="120" cy="130" r="6" fill={ACCENT} />
    </>
  ),
  'dnd-kit': (
    <>
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect key={`${col}-${row}`} x={34 + col * 62} y={30 + row * 46} width="50" height="34" rx="6" fill={row === 0 ? SOFT : SURFACE} stroke={row === 0 ? ACCENT : MUTED} strokeWidth="2" />
        )),
      )}
      <rect x="96" y="122" width="50" height="26" rx="6" fill={ACCENT} />
    </>
  ),
  'auto-animate': (
    <>
      <rect x="30" y="44" width="80" height="26" rx="6" fill={SOFT} stroke={ACCENT} />
      <rect x="130" y="44" width="80" height="26" rx="6" fill={SOFT} stroke={ACCENT} />
      <rect x="30" y="92" width="180" height="26" rx="6" fill={SURFACE} stroke={MUTED} />
      <path d="M70 80 V86 M170 80 V86" stroke={ACCENT} strokeWidth="2" />
    </>
  ),
  moveable: (
    <>
      <rect x="78" y="46" width="84" height="68" rx="8" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      {[[78, 46], [162, 46], [78, 114], [162, 114]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width="10" height="10" fill={SURFACE} stroke={ACCENT} strokeWidth="2" />
      ))}
      <circle cx="162" cy="80" r="10" fill={ACCENT} />
    </>
  ),
  echarts: (
    <>
      {[44, 72, 38, 86, 60].map((h, i) => (
        <rect key={i} x={34 + i * 32} y={126 - h} width="20" height={h} rx="3" fill={i === 3 ? ACCENT : SOFT} stroke={ACCENT} />
      ))}
      <rect x="24" y="18" width="192" height="18" rx="5" fill={SOFT} />
    </>
  ),
  d3: (
    <>
      <path d="M26 122 H214" stroke={MUTED} />
      <path d="M30 122 V26" stroke={MUTED} />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={44 + i * 40} cy={110 - [0, 40, 22, 62, 30][i]} r="8" fill={i === 3 ? ACCENT : SOFT} stroke={ACCENT} strokeWidth="2" />
      ))}
      <path d="M44 110 C 70 70 100 100 124 48 C 150 84 176 96 204 80" fill="none" stroke={ACCENT} strokeWidth="2.5" />
    </>
  ),
  chartjs: (
    <>
      <path d="M30 118 C 66 70 96 100 128 56 C 158 96 186 60 210 44" fill="none" stroke={ACCENT} strokeWidth="4" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={36 + i * 26} y={122 - [30, 52, 20][i]} width="14" height={[30, 52, 20][i]} fill={SOFT} stroke={ACCENT} />
      ))}
    </>
  ),
  recharts: (
    <>
      {[40, 70, 34, 88, 56].map((h, i) => (
        <rect key={i} x={34 + i * 34} y={126 - h} width="18" height={h} rx="3" fill={i === 3 ? ACCENT : SOFT} />
      ))}
      <rect x="24" y="112" width="192" height="14" rx="7" fill={SOFT} />
      <rect x="88" y="112" width="60" height="14" rx="7" fill={ACCENT} />
    </>
  ),
  'observable-plot': (
    <>
      {[20, 46, 74, 96, 60, 34, 82, 48].map((h, i) => (
        <rect key={i} x={28 + i * 24} y={126 - h} width="18" height={h} rx="2" fill={ACCENT} opacity={0.45 + (i % 3) * 0.25} />
      ))}
      <path d="M28 126 H212" stroke={MUTED} />
    </>
  ),
  uplot: (
    <>
      <path d="M24 128 H216" stroke={MUTED} />
      <path d="M24 120 L40 96 L52 108 L66 62 L80 78 L94 44 L110 70 L124 52 L140 84 L156 40 L172 62 L188 34 L210 48" fill="none" stroke={ACCENT} strokeWidth="2" />
      <rect x="94" y="20" width="34" height="112" fill={SOFT} opacity=".7" />
    </>
  ),
  g6: (
    <>
      <circle cx="70" cy="60" r="15" fill={ACCENT} />
      <circle cx="170" cy="50" r="12" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <circle cx="120" cy="118" r="12" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <circle cx="200" cy="120" r="9" fill={MUTED} />
      <path d="M70 60 L170 50 M70 60 L120 118 M170 50 L200 120 M120 118 L200 120" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  x6: (
    <>
      <rect x="30" y="34" width="66" height="44" rx="8" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <rect x="150" y="86" width="66" height="44" rx="8" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <path d="M96 56 H126 Q142 56 142 74 V108 Q142 108 150 108" fill="none" stroke={ACCENT} strokeWidth="2.5" />
      <circle cx="96" cy="56" r="5" fill={ACCENT} />
      <circle cx="150" cy="108" r="5" fill={ACCENT} />
    </>
  ),
  mermaid: (
    <>
      <rect x="96" y="24" width="56" height="26" rx="6" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <rect x="30" y="76" width="52" height="26" rx="6" fill={ACCENT} />
      <rect x="100" y="76" width="52" height="26" rx="6" fill={SURFACE} stroke={MUTED} />
      <rect x="170" y="76" width="40" height="26" rx="6" fill={SURFACE} stroke={MUTED} />
      <path d="M124 50 V62 H56 V76 M124 62 V76 M124 62 H190 V76" fill="none" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  'react-flow': (
    <>
      <rect x="28" y="30" width="62" height="38" rx="8" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <rect x="150" y="70" width="62" height="38" rx="8" fill={SURFACE} stroke={ACCENT} strokeWidth="2" />
      <rect x="28" y="110" width="62" height="38" rx="8" fill={SURFACE} stroke={MUTED} />
      <path d="M90 49 Q130 49 150 89 M90 49 Q120 49 59 129" fill="none" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  leaflet: (
    <>
      <rect x="24" y="24" width="192" height="112" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      {[1, 2, 3].map((i) => (
        <path key={i} d={`M24 ${24 + i * 28} H216 M${24 + i * 48} 24 V136`} stroke={MUTED} strokeOpacity=".3" />
      ))}
      <path d="M40 100 C 80 70 100 74 130 62 C 160 50 180 58 200 44" fill="none" stroke={ACCENT} strokeWidth="2.5" />
      {[[70, 92], [130, 62], [190, 50]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 1 ? 7 : 5} fill={ACCENT} />
      ))}
    </>
  ),
  'maplibre-gl': (
    <>
      <rect x="24" y="24" width="192" height="112" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      <path d="M30 100 L80 70 L120 96 L170 56 L210 78 V132 H30 Z" fill={SOFT} />
      <path d="M30 100 L80 70 L120 96 L170 56 L210 78" fill="none" stroke={ACCENT} strokeWidth="2.5" />
      <circle cx="120" cy="96" r="6" fill={ACCENT} />
      <circle cx="170" cy="56" r="5" fill={ACCENT} />
    </>
  ),
  zod: (
    <>
      <rect x="40" y="30" width="160" height="100" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="56" y={46 + i * 26} width={i === 1 ? 72 : 128} height="16" rx="4" fill={i === 1 ? SOFT : 'var(--surface-2)'} stroke={i === 1 ? ACCENT : MUTED} strokeOpacity={i === 1 ? 1 : 0.4} />
      ))}
      <path d="M120 44 l7 7 l-7 7" fill="none" stroke={ACCENT} strokeWidth="2.5" />
    </>
  ),
  'tanstack-query': (
    <>
      <circle cx="60" cy="52" r="16" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <circle cx="60" cy="112" r="16" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <rect x="140" y="66" width="66" height="34" rx="8" fill={ACCENT} />
      <path d="M78 58 H124 Q136 58 136 78 M78 106 H124 Q136 106 136 88" fill="none" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  swr: (
    <>
      <path d="M120 40 a44 44 0 1 1 -38 22" fill="none" stroke={MUTED} strokeWidth="3" />
      <path d="M120 62 a22 22 0 1 1 -18 11" fill="none" stroke={ACCENT} strokeWidth="3" />
      <circle cx="120" cy="84" r="8" fill={ACCENT} />
    </>
  ),
  zustand: (
    <>
      <rect x="28" y="36" width="80" height="42" rx="10" fill={ACCENT} />
      <rect x="132" y="36" width="80" height="42" rx="10" fill={SURFACE} stroke={ACCENT} strokeWidth="2" />
      <rect x="28" y="96" width="184" height="34" rx="10" fill={SOFT} stroke={MUTED} />
      <path d="M68 78 V96 M172 78 V96" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  'redux-toolkit': (
    <>
      <rect x="30" y="30" width="180" height="30" rx="8" fill={SOFT} stroke={ACCENT} />
      <rect x="30" y="70" width="180" height="30" rx="8" fill={ACCENT} />
      <rect x="30" y="110" width="180" height="30" rx="8" fill={SURFACE} stroke={MUTED} />
      <path d="M120 60 V70 M120 100 V110" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  jotai: (
    <>
      <circle cx="60" cy="80" r="18" fill={ACCENT} />
      <circle cx="180" cy="46" r="15" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <circle cx="180" cy="114" r="15" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <path d="M78 80 H162 M180 62 V98" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  htmx: (
    <>
      <rect x="30" y="30" width="180" height="26" rx="7" fill={SURFACE} stroke={LINE_STRONG} />
      <path d="M42 43 l6 0 M54 43 l6 0" stroke={MUTED} strokeWidth="2" />
      <rect x="30" y="68" width="180" height="66" rx="10" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="44" y={80 + i * 16} width={130 - i * 30} height="7" rx="3" fill={i === 0 ? ACCENT : MUTED} opacity={i === 0 ? 1 : 0.5} />
      ))}
    </>
  ),
  'radix-ui': (
    <>
      <rect x="24" y="40" width="192" height="84" rx="12" fill="var(--surface-2)" stroke={MUTED} strokeOpacity=".4" />
      <rect x="56" y="58" width="128" height="52" rx="10" fill={SURFACE} stroke={ACCENT} strokeWidth="2" />
      <rect x="72" y="72" width="60" height="10" rx="5" fill={ACCENT} />
      <rect x="72" y="90" width="90" height="8" rx="4" fill={MUTED} opacity=".5" />
    </>
  ),
  'ant-design': (
    <>
      <rect x="24" y="34" width="192" height="94" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      <path d="M24 58 H216" stroke={MUTED} strokeOpacity=".5" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={40 + i * 44} y="42" width="26" height="10" rx="3" fill={MUTED} opacity=".5" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x="40" y={72 + i * 18} width={160 - i * 34} height="8" rx="4" fill={i === 0 ? ACCENT : MUTED} opacity={i === 0 ? 1 : 0.45} />
      ))}
    </>
  ),
  mantine: (
    <>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={34 + i * 62} y="46" width="50" height="26" rx="13" fill={i === 0 ? ACCENT : SURFACE} stroke={i === 0 ? ACCENT : MUTED} strokeWidth="2" />
      ))}
      <rect x="34" y="92" width="172" height="16" rx="8" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <circle cx="86" cy="100" r="6" fill={ACCENT} />
    </>
  ),
  tiptap: (
    <>
      <rect x="26" y="26" width="188" height="24" rx="7" fill={SOFT} />
      <path d="M40 38 h12 M72 32 v12 M72 32 h10 v12 h-10 z" stroke={ACCENT} strokeWidth="2" fill="none" />
      <rect x="26" y="60" width="188" height="76" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      <rect x="40" y="74" width="70" height="9" rx="3" fill={ACCENT} />
      <rect x="40" y="92" width="160" height="7" rx="3" fill={MUTED} opacity=".45" />
      <rect x="40" y="110" width="120" height="7" rx="3" fill={MUTED} opacity=".35" />
    </>
  ),
  lexical: (
    <>
      <rect x="30" y="34" width="180" height="96" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="46" y={50 + i * 20} width={i === 0 ? 88 : 148 - i * 22} height="9" rx="3" fill={i === 0 ? ACCENT : MUTED} opacity={i === 0 ? 1 : 0.45} />
      ))}
    </>
  ),
  prosemirror: (
    <>
      <path d="M34 30 V130 M34 130 H210" stroke={MUTED} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={46} y={40 + i * 22} width={i === 2 ? 40 : 140 - i * 14} height="10" rx="3" fill={i === 2 ? ACCENT : SOFT} stroke={i === 2 ? ACCENT : 'none'} />
      ))}
      <circle cx="30" cy="130" r="6" fill={ACCENT} />
    </>
  ),
  quill: (
    <>
      <rect x="26" y="30" width="188" height="100" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      <path d="M26 56 H214" stroke={MUTED} strokeOpacity=".4" />
      <rect x="40" y="40" width="10" height="10" rx="2" fill={ACCENT} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="40" y={72 + i * 18} width={156 - i * 30} height="8" rx="4" fill={MUTED} opacity=".45" />
      ))}
    </>
  ),
  codemirror: (
    <>
      <rect x="24" y="30" width="192" height="102" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="36" y={44 + i * 20} width="16" height="7" rx="2" fill={MUTED} opacity=".4" />
          <rect x="60" y={44 + i * 20} width={i === 1 ? 60 : 108 - i * 18} height="7" rx="2" fill={i === 1 ? ACCENT : SOFT} />
        </g>
      ))}
      <path d="M50 30 V132" stroke={ACCENT} strokeOpacity=".3" />
    </>
  ),
  'markdown-it': (
    <>
      <rect x="30" y="34" width="80" height="96" rx="8" fill={SURFACE} stroke={MUTED} />
      <rect x="130" y="34" width="80" height="96" rx="8" fill={SURFACE} stroke={ACCENT} strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="40" y={48 + i * 24} width={56 - i * 10} height="6" rx="3" fill={MUTED} opacity=".5" />
          <rect x="140" y={48 + i * 24} width={60 - i * 12} height="7" rx="3" fill={ACCENT} opacity={1 - i * 0.25} />
        </g>
      ))}
      <path d="M114 82 H126" stroke={ACCENT} strokeWidth="2.5" />
    </>
  ),
  shiki: (
    <>
      <rect x="26" y="30" width="188" height="104" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      <rect x="26" y="30" width="188" height="18" rx="10" fill={SOFT} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={40 + i * 12} y={64 + i * 16} width={130 - i * 22} height="8" rx="3" fill={[ACCENT, SOFT, MUTED, SOFT][i]} opacity={[0.9, 0.7, 0.45, 0.7][i]} />
      ))}
    </>
  ),
  katex: (
    <>
      <path d="M40 116 h50 l22 -62" fill="none" stroke={ACCENT} strokeWidth="4" />
      <path d="M120 60 q14 -22 28 -4" fill="none" stroke={ACCENT} strokeWidth="3" />
      <path d="M148 60 q14 -22 28 -4" fill="none" stroke={ACCENT} strokeWidth="3" />
      <path d="M28 128 H212" stroke={MUTED} strokeDasharray="4 4" />
      <rect x="60" y="26" width="48" height="10" rx="3" fill={MUTED} opacity=".4" />
      <rect x="128" y="26" width="30" height="10" rx="3" fill={MUTED} opacity=".4" />
    </>
  ),
  remark: (
    <>
      <path d="M52 34 L32 82 L52 130 M188 34 L208 82 L188 130" fill="none" stroke={ACCENT} strokeWidth="3" />
      <rect x="76" y="52" width="88" height="16" rx="4" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <rect x="88" y="76" width="64" height="10" rx="4" fill={MUTED} opacity=".45" />
      <rect x="76" y="98" width="88" height="16" rx="4" fill={SOFT} stroke={MUTED} strokeWidth="2" />
    </>
  ),
  culori: (
    <>
      <defs>
        <linearGradient id="culori-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ACCENT} />
          <stop offset="100%" stopColor="#4a90d9" />
        </linearGradient>
      </defs>
      <rect x="30" y="56" width="180" height="26" rx="13" fill="url(#culori-g)" />
      <circle cx="30" cy="69" r="14" fill={ACCENT} />
      <circle cx="210" cy="69" r="14" fill="#4a90d9" />
      <path d="M40 112 H200" stroke={MUTED} strokeDasharray="4 4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={50 + i * 35} cy={112} r="6" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      ))}
    </>
  ),
  colorjs: (
    <>
      <rect x="40" y="40" width="70" height="70" rx="10" fill="#d94f4f" />
      <rect x="130" y="40" width="70" height="70" rx="10" fill={ACCENT} />
      <path d="M110 40 V110" stroke={MUTED} strokeDasharray="4 4" />
      <rect x="60" y="124" width="120" height="14" rx="7" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
    </>
  ),
  prettier: (
    <>
      <rect x="26" y="30" width="188" height="104" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={40 + (i % 2) * 16} y={44 + i * 17} width={i === 4 ? 60 : 150 - i * 14} height="7" rx="3" fill={i === 2 ? ACCENT : MUTED} opacity={i === 2 ? 1 : 0.45} />
      ))}
      <path d="M190 118 l10 10 l16 -20" fill="none" stroke={ACCENT} strokeWidth="3" />
    </>
  ),
  typescript: (
    <>
      <rect x="30" y="32" width="180" height="100" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      <path d="M62 62 h34 v14 h-24 v22 h24" fill="none" stroke={ACCENT} strokeWidth="3" />
      <path d="M126 58 h26 v40 h-26" fill="none" stroke={ACCENT} strokeWidth="3" />
      <circle cx="176" cy="112" r="13" fill="none" stroke={ACCENT} strokeWidth="2.5" />
    </>
  ),
  esbuild: (
    <>
      <rect x="24" y="34" width="86" height="92" rx="9" fill={SURFACE} stroke={MUTED} />
      <rect x="130" y="34" width="86" height="92" rx="9" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="34" y={46 + i * 19} width={66 - i * 12} height="6" rx="3" fill={MUTED} opacity=".5" />
          <rect x="140" y={46 + i * 19} width={66 - i * 12} height="6" rx="3" fill={ACCENT} opacity=".6" />
        </g>
      ))}
      <path d="M114 74 H126 M120 68 l6 6 l-6 6" fill="none" stroke={ACCENT} strokeWidth="2.5" />
    </>
  ),
  d1: (
    <>
      <ellipse cx="120" cy="46" rx="72" ry="18" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <path d="M48 46 V114 c0 10 32 18 72 18 s72 -8 72 -18 V46" fill="none" stroke={ACCENT} strokeWidth="2.5" />
      <ellipse cx="120" cy="114" rx="72" ry="18" fill="none" stroke={ACCENT} strokeWidth="2.5" opacity=".55" />
      <path d="M48 80 c0 10 32 18 72 18 s72 -8 72 -18" fill="none" stroke={MUTED} strokeWidth="2" />
    </>
  ),
  drizzle: (
    <>
      <rect x="30" y="34" width="80" height="40" rx="8" fill={ACCENT} />
      <rect x="130" y="86" width="80" height="40" rx="8" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <path d="M110 54 H130 Q126 54 126 62 V106 Q126 106 130 106" fill="none" stroke={MUTED} strokeWidth="2" />
      <circle cx="110" cy="54" r="5" fill={ACCENT} />
    </>
  ),
  kysely: (
    <>
      <rect x="26" y="30" width="188" height="104" rx="10" fill={SURFACE} stroke={LINE_STRONG} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="40" y={44 + i * 20} width={i === 0 ? 54 : 160 - i * 20} height="7" rx="3" fill={i === 0 ? ACCENT : MUTED} opacity={i === 0 ? 1 : 0.45} />
      ))}
      <circle cx="196" cy="118" r="12" fill={ACCENT} />
      <path d="M192 118 l3 3 l6 -7" stroke={SURFACE} strokeWidth="2" fill="none" />
    </>
  ),
  hono: (
    <>
      <rect x="26" y="30" width="188" height="26" rx="7" fill={SOFT} stroke={ACCENT} strokeWidth="2" />
      <path d="M40 43 h12 M58 39 v8 M58 39 h8 v8 h-8 z" stroke={ACCENT} strokeWidth="1.8" fill="none" />
      <rect x="26" y="68" width="188" height="30" rx="7" fill={SURFACE} stroke={MUTED} />
      <rect x="26" y="104" width="188" height="30" rx="7" fill={ACCENT} />
    </>
  ),
  r2: (
    <>
      <rect x="28" y="38" width="92" height="86" rx="10" fill={SOFT} stroke={ACCENT} strokeWidth="2.5" />
      <rect x="132" y="60" width="80" height="44" rx="9" fill={SURFACE} stroke={MUTED} strokeWidth="2" />
      <path d="M120 68 h12 M126 64 l6 4 l-6 4" fill="none" stroke={ACCENT} strokeWidth="2" />
      <path d="M44 60 h60 M44 78 h60 M44 96 h38" stroke={MUTED} strokeWidth="2.5" />
    </>
  ),
};

export function LabThumb({ stack }: { stack: string }) {
  const content = ART[stack];
  if (!content) {
    return (
      <div className={`demo-thumb demo-thumb--lab demo-thumb--${stack}`} aria-hidden="true">
        <svg viewBox="0 0 240 160" fill="none">
          <rect x="46" y="52" width="148" height="56" rx="12" fill="var(--surface-2)" stroke={ACCENT} />
          <circle cx="80" cy="80" r="10" fill={ACCENT} />
          <rect x="102" y="70" width="70" height="8" rx="4" fill={MUTED} opacity=".5" />
          <rect x="102" y="86" width="44" height="8" rx="4" fill={MUTED} opacity=".35" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`demo-thumb demo-thumb--lab demo-thumb--${stack}`} aria-hidden="true">
      <svg viewBox="0 0 240 160" fill="none">
        {content}
      </svg>
    </div>
  );
}

/** Compat wrapper: call sites that still have a kind string. */
export function DemoThumb({ stack }: { stack: string; kind?: string }) {
  return <LabThumb stack={stack} />;
}
