import { assetUrl } from '../lib/runtime';
import { useEffect, useState } from 'react';
import type { Tool } from '../types';

interface ToolLogoProps {
  tool: Pick<Tool, 'name' | 'icon' | 'logo' | 'logoDark' | 'logoOnDark'>;
  className?: string;
}

/**
 * Only same-site icon assets are accepted. The catalog API stores them under
 * /media/icons/; anything else falls back to the catalog's text mark.
 */
function localIconSource(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const path = value.split(/[?#]/, 1)[0];
  return path.startsWith('/media/icons/') ? assetUrl(value) : undefined;
}

export function ToolLogo({ tool, className = '' }: ToolLogoProps) {
  const lightSource = localIconSource(tool.logo);
  const darkSource = localIconSource(tool.logoDark);
  const [failed, setFailed] = useState({ light: false, dark: false });

  useEffect(() => {
    setFailed({ light: false, dark: false });
  }, [lightSource, darkSource]);

  const lightReady = Boolean(lightSource) && !failed.light;
  const darkReady = Boolean(darkSource) && !failed.dark;
  const hasDarkVariant = darkReady;

  return (
    <span
      className={`tool-icon tool-logo${hasDarkVariant ? ' tool-logo--with-dark' : ''}${
        lightReady || darkReady ? '' : ' tool-logo--fallback'
      }${tool.logoOnDark ? ' tool-logo--dark-plate' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      {lightReady ? (
        <img
          className="tool-logo__img tool-logo__img--light"
          src={lightSource}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed((current) => ({ ...current, light: true }))}
        />
      ) : null}
      {darkReady ? (
        <img
          className="tool-logo__img tool-logo__img--dark"
          src={darkSource}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed((current) => ({ ...current, dark: true }))}
        />
      ) : null}
      {!lightReady ? (
        <span className="tool-logo__fallback tool-logo__fallback--light">{tool.icon}</span>
      ) : null}
      {!lightReady && !darkReady ? (
        <span className="tool-logo__fallback tool-logo__fallback--dark">{tool.icon}</span>
      ) : null}
    </span>
  );
}
