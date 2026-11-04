import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Grid2X2, Heart, Home, QrCode, Search, Share2, Sparkles, X, Maximize, Minimize } from 'lucide-react';
import type { Catalog } from '../types';
import { routeHref } from '../lib/runtime';
import { navigate } from '../lib/router';
import { Brand } from '../components/Brand';
import { CategoryIcon } from '../components/icons';
import { ThemeMenu } from '../components/ThemeMenu';
import type { ThemeMode } from '../hooks/useTheme';
import { useDialog } from '../hooks/useDialog';
import { writeClipboard } from '../lib/clipboard';
import { sharePath, supports } from './sdk';

export function ToyHeader({title, logical, onSearch, mode, resolved, setMode, notify}: {
  title: string; logical: string; onSearch: () => void; mode: ThemeMode; resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void; notify: (text: string) => void;
}) {
  const inDemo = logical.startsWith('/demos/');
  const [qr, setQr] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [canQr, setCanQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setQr(''), []);
  useDialog(Boolean(qr), qrRef, close);
  useEffect(() => { void supports('share').then(setCanShare); void supports('getQrCode').then(setCanQr); }, []);
  useEffect(() => { setQr(''); }, [logical]);
  const share = async () => {
    try {
      if (canShare) await window.toy!.share({path: sharePath(logical)});
      else {
        const base = new URL('./', window.location.href);
        if (base.hostname === 'www.bilibilitoy.com') base.hostname = 'www.bilibili.com';
        const url = new URL(sharePath(logical), base);
        if (await writeClipboard(url.href)) notify('链接已复制');
        else notify('无法复制链接，请使用浏览器分享');
      }
    } catch { notify('分享暂不可用，请重试'); }
  };
  return <>
    <header className="toy-header">
      <div className="toy-header__row">
        {/^\/(tools|demos)\//.test(logical) ? <button className="icon-button" aria-label="返回上一页" onClick={() => window.history.state?.vibeFrom ? window.history.back() : navigate(logical.startsWith('/demos/') ? '/demos' : '/')}><ArrowLeft size={20}/></button> : <a href={routeHref('/')} aria-label="Vibe 工具集首页"><Brand compact /></a>}
        <span className="toy-header__title">{title}</span>
        <div className="toy-header__actions">
          {inDemo ? <button className="icon-button" aria-label="搜索工具" onClick={onSearch}><Search size={19}/></button> : null}
          <ThemeMenu mode={mode} resolved={resolved} setMode={setMode}/>
          <button className="icon-button" aria-label="分享当前页面" onClick={() => void share()}><Share2 size={19}/></button>
          {canQr && !inDemo ? <button className="icon-button" disabled={busy} aria-label="页面二维码" onClick={async () => {
            setBusy(true);
            try { const data = await window.toy!.getQrCode({path: sharePath(logical), size: 320}); setQr(data.base64); }
            catch { notify('二维码暂不可用'); } finally { setBusy(false); }
          }}><QrCode size={19}/></button> : null}
        </div>
      </div>
      {!inDemo ? <button className="toy-search" onClick={onSearch}><Search size={18}/><span>搜索工具、分类或关键词</span></button> : null}
    </header>
    {qr ? <div className="toy-modal-backdrop" onClick={e => {if (e.target === e.currentTarget) close();}}><div className="toy-qr" role="dialog" aria-modal="true" aria-label="当前页面二维码" tabIndex={-1} ref={qrRef}><button className="icon-button" onClick={close} aria-label="关闭二维码"><X size={20}/></button><h2>手机扫码打开</h2><img src={qr} alt="当前 Toy 页面的二维码" width="280" height="280"/></div></div> : null}
  </>;
}
export function ToyNav({pathname, search, count}: {pathname: string; search: string; count: number}) {
  const favorites = new URLSearchParams(search).get('favorites') === '1';
  const category = new URLSearchParams(search).has('category');
  const links = [
    {label: '首页', href: '/', icon: Home, active: pathname === '/' && !favorites && !category},
    {label: '分类', href: '/categories', icon: Grid2X2, active: pathname === '/categories' || (!favorites && (category || pathname.startsWith('/tools/')))},
    {label: '示例', href: '/demos', icon: Sparkles, active: pathname.startsWith('/demos')},
    {label: '收藏', href: '/?favorites=1', icon: Heart, active: (pathname === '/' || pathname.startsWith('/tools/')) && favorites},
  ];
  return <nav className="toy-nav" aria-label="主导航">{links.map(item => <a key={item.label} href={routeHref(item.href)} aria-current={item.active ? 'page' : undefined}><item.icon size={21}/><span>{item.label}{item.label === '收藏' && count > 0 ? <small>{count}</small> : null}</span></a>)}</nav>;
}
export function ToyCategories({catalog}: {catalog: Catalog}) {
  return <section className="page toy-categories"><header className="browse-heading"><h1>分类</h1><span>{catalog.categories.length} 个分类 · {catalog.tools.length} 个工具</span></header><div className="toy-category-grid">{catalog.categories.map(c => <a href={routeHref('/?category=' + encodeURIComponent(c.id))} key={c.id}><span className="toy-category-icon"><CategoryIcon id={c.id} size={23}/></span><strong>{c.name}</strong><small>{catalog.tools.filter(t => t.categoryId === c.id).length} 个工具</small><ArrowUpRight size={16}/></a>)}</div></section>;
}
export function ToyOverview({catalog}: {catalog: Catalog}) {
  return <section className="toy-overview" aria-label="目录数据"><a href={routeHref('/categories')}><strong>{catalog.tools.length}</strong><span>收录工具</span></a><a href={routeHref('/demos')}><strong>{catalog.demos.length}</strong><span>真实示例</span></a><div><strong>{catalog.categories.length}</strong><span>工具分类</span></div><p>更新于 <time dateTime={catalog.updatedAt}>{catalog.updatedAt.slice(0,10)}</time></p></section>;
}
export function ToyStageMode({notify}: {notify: (text: string) => void}) {
  const ownsMode = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const [supported, setSupported] = useState(false);
  const [applied, setApplied] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => { void supports('setContainerMode').then(setSupported); return () => { clearTimeout(timer.current); if (ownsMode.current) void window.toy?.setContainerMode({orientation: 'portrait', immersive: false}).catch(() => {}); }; }, []);
  useEffect(() => {
    const update = () => {setApplied(document.documentElement.dataset.immersive === 'true'); setPending(false);};
    window.addEventListener('resize', update); return () => window.removeEventListener('resize', update);
  }, []);
  if (!supported) return null;
  return <button className="button button--secondary button--small" disabled={pending} onClick={async () => {
    setPending(true);
    try {
      ownsMode.current = !applied;
      await window.toy!.setContainerMode({orientation: applied ? 'portrait' : 'landscape', immersive: !applied});
      // A resolved Promise is not proof. Only the container callback updates applied.
      timer.current = window.setTimeout(() => { setPending(false); if ((document.documentElement.dataset.immersive === 'true') === applied) notify('客户端未确认模式切换，可继续竖屏使用'); }, 2000);
    } catch { setPending(false); notify('当前客户端无法切换显示模式'); }
  }}>{applied ? <Minimize size={15}/> : <Maximize size={15}/>}{pending ? '等待客户端确认' : applied ? '恢复竖屏' : '横屏沉浸'}</button>;
}
