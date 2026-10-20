import { useEffect, useState } from 'react';
import { loadVisitorStats, type VisitorStats } from '../lib/visitors';
import { Sparkles, Users } from 'lucide-react';
import { formatUpdatedAt } from '../lib/catalog';
import { Brand } from './Brand';

interface FooterProps {
  updatedAt: string;
}

export function Footer({ updatedAt }: FooterProps) {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  useEffect(() => {
    let active = true;
    void loadVisitorStats().then(value => { if (active) setStats(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
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
        <p className="site-footer__visitors" aria-label="网站访问统计" title="按匿名浏览器标识去重；同一人在不同浏览器访问会分别计数。">
          <Users size={13} aria-hidden="true" />
          累计访客 <span>{stats ? stats.total.toLocaleString('zh-CN') : '—'}</span>
          <span className="site-footer__separator" aria-hidden="true">·</span>
          今日访客 <span>{stats ? stats.today.toLocaleString('zh-CN') : '—'}</span>
        </p>
        <p>非官方目录 · 价格与功能以各工具官网为准</p>
        <p>
          <Sparkles size={12} aria-hidden="true" />
          内容整理于 {formatUpdatedAt(updatedAt)}
        </p>
      </div>
    </footer>
  );
}
