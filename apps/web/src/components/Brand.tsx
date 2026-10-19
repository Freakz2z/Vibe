import { useState } from 'react';

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  const [logoSrc, setLogoSrc] = useState('/media/brand/logo.png');

  return (
    <span className={`brand${compact ? ' brand--compact' : ''}`}>
      <span className="brand__mark">
        <img
          src={logoSrc}
          alt=""
          width="36"
          height="36"
          onError={() => {
            if (!logoSrc.startsWith('/brand/')) setLogoSrc('/brand/logo.png');
          }}
        />
      </span>
      <span className="brand__text">
        <span className="brand__name">Vibe 工具集</span>
        {!compact && <span className="brand__tagline">中文工具导航</span>}
      </span>
    </span>
  );
}
