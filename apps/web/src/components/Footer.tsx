import { Sparkles } from 'lucide-react';
import { formatUpdatedAt } from '../lib/catalog';
import { Brand } from './Brand';

interface FooterProps {
  updatedAt: string;
}

export function Footer({ updatedAt }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a href="/" aria-label="Vibe 工具集首页">
            <Brand compact />
          </a>
        </div>
        <nav className="site-footer__nav" aria-label="页脚导航">
          <a href="/">首页</a>
          <a href="/demos">站内示例</a>
        </nav>
      </div>
      <div className="site-footer__bottom">
        <p>非官方目录 · 价格与功能以各工具官网为准</p>
        <p>
          <Sparkles size={12} aria-hidden="true" />
          内容整理于 {formatUpdatedAt(updatedAt)}
        </p>
      </div>
    </footer>
  );
}
