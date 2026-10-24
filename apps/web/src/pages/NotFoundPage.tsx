import { routeHref } from '../lib/runtime';
import { ArrowLeft, Compass } from 'lucide-react';

interface NotFoundPageProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function NotFoundPage({
  title = '这一页没有找到',
  description = '地址可能已经变化，或者这项内容还没有被收录。回到目录继续看看。',
  backHref = '/',
  backLabel = '回到工具目录',
}: NotFoundPageProps) {
  return (
    <div className="page notfound-page">
      <span className="notfound-page__mark" aria-hidden="true">
        404
      </span>
      <p className="eyebrow">走丢了</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="notfound-page__actions">
        <a className="button button--primary" href={routeHref(backHref)}>
          <ArrowLeft size={15} aria-hidden="true" />
          {backLabel}
        </a>
        <a className="button button--secondary" href={routeHref('/demos')}>
          <Compass size={15} aria-hidden="true" />
          看看站内示例
        </a>
      </div>
    </div>
  );
}
