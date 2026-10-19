import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Brand } from './Brand';

export function LoadingScreen() {
  return (
    <div className="startup-screen" aria-busy="true">
      <div className="startup-screen__brand">
        <Brand />
      </div>
      <div className="startup-status" role="status">
        <span className="startup-status__spinner" aria-hidden="true" />
        <div>
          <p>正在整理工具目录…</p>
          <span>从目录服务读取最新内容</span>
        </div>
      </div>
      <div className="startup-skeleton" aria-hidden="true">
        {[0, 1, 2].map((column) => (
          <div className="startup-skeleton__card" key={column}>
            <i />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="startup-screen">
      <div className="startup-screen__brand">
        <Brand />
      </div>
      <div className="startup-error" role="alert">
        <span className="startup-error__icon" aria-hidden="true">
          <TriangleAlert size={24} />
        </span>
        <p className="eyebrow">连接没有完成</p>
        <h1>工具目录暂时没加载出来</h1>
        <p>{message}</p>
        <button type="button" className="button button--primary" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" />
          重新加载
        </button>
        <small>如果正在本地运行，请确认目录服务已经启动后再试。</small>
      </div>
    </div>
  );
}
