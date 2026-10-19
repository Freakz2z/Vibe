import { Heart, Sparkles } from 'lucide-react';
import { formatUpdatedAt } from '../lib/catalog';
import { Brand } from './Brand';

interface FooterProps {
  updatedAt: string;
  onAbout: () => void;
}

export function Footer({ updatedAt, onAbout }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a href="/" aria-label="Vibe 工具集首页">
            <Brand compact />
          </a>
          <p>为独立开发者与 AI 编程创造者整理的中文工具导航。</p>
        </div>
        <nav className="site-footer__nav" aria-label="页脚导航">
          <a href="/">全部工具</a>
          <a href="/demos">站内示例</a>
          <button type="button" onClick={onAbout}>
            关于与选型说明
          </button>
        </nav>
      </div>
      <div className="site-footer__bottom">
        <p>
          <Heart size={12} aria-hidden="true" />
          收藏仅存本机 · 非官方目录 · 价格与功能以各工具官网为准
        </p>
        <p>
          <Sparkles size={12} aria-hidden="true" />
          内容整理于 {formatUpdatedAt(updatedAt)}
        </p>
      </div>
    </footer>
  );
}
