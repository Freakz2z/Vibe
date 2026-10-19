import type { CSSProperties } from 'react';
import type { Demo } from '../types';

const PARTICLES = [
  [18, 30],
  [32, 62],
  [46, 22],
  [58, 54],
  [72, 34],
  [83, 66],
  [27, 82],
  [64, 82],
  [88, 24],
  [40, 44],
  [53, 72],
  [76, 48],
] as const;

export function DemoThumb({ kind }: { kind: Demo['kind'] }) {
  if (kind === 'spring') {
    return (
      <div className="demo-thumb demo-thumb--spring" aria-hidden="true">
        <span className="spring-orbit spring-orbit--one" />
        <span className="spring-orbit spring-orbit--two" />
        <span className="spring-ball" />
        <span className="spring-line" />
      </div>
    );
  }

  if (kind === 'chart') {
    return (
      <div className="demo-thumb demo-thumb--chart" aria-hidden="true">
        <span className="mini-chart-axis" />
        <span className="mini-bar" style={{ '--bar-height': '46%' } as CSSProperties} />
        <span className="mini-bar" style={{ '--bar-height': '71%' } as CSSProperties} />
        <span className="mini-bar" style={{ '--bar-height': '38%' } as CSSProperties} />
        <span className="mini-bar" style={{ '--bar-height': '84%' } as CSSProperties} />
        <span className="mini-bar" style={{ '--bar-height': '60%' } as CSSProperties} />
        <svg className="mini-chart-line" viewBox="0 0 160 76" preserveAspectRatio="none">
          <polyline points="8,54 40,38 72,48 104,18 136,30 156,16" fill="none" />
        </svg>
      </div>
    );
  }

  if (kind === 'gradient') {
    return (
      <div className="demo-thumb demo-thumb--gradient" aria-hidden="true">
        <span className="gradient-orb" />
        <span className="gradient-code">linear</span>
      </div>
    );
  }

  if (kind === 'kanban') {
    return (
      <div className="demo-thumb demo-thumb--kanban" aria-hidden="true">
        {[0, 1, 2].map((column) => (
          <span className={`mini-lane mini-lane--${column}`} key={column}>
            <i />
            <i />
            {column === 1 ? <i className="is-dragging" /> : null}
          </span>
        ))}
      </div>
    );
  }

  if (kind === 'particles') {
    return (
      <div className="demo-thumb demo-thumb--particles" aria-hidden="true">
        <span className="particle-attractor" />
        {PARTICLES.map(([left, top], index) => (
          <span
            className="mini-particle"
            key={`${left}-${top}`}
            style={
              {
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${index * -0.22}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="demo-thumb demo-thumb--markdown" aria-hidden="true">
      <span className="mini-md-line mini-md-line--heading" />
      <span className="mini-md-line" />
      <span className="mini-md-line mini-md-line--short" />
      <span className="mini-md-code">
        <i />
        <i />
      </span>
      <span className="mini-md-line" />
      <span className="mini-md-line mini-md-line--short" />
    </div>
  );
}
