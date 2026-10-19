import type { Demo } from '../types';
import { DemoCard } from '../components/DemoCard';

export function DemosPage({ demos }: { demos: Demo[] }) {
  return (
    <div className="page demos-page">
      <header className="browse-heading demos-page__heading">
        <p className="eyebrow">站内示例</p>
      </header>

      <div className="demo-grid demo-grid--page">
        {demos.map((demo) => (
          <DemoCard key={demo.id} demo={demo} />
        ))}
      </div>

      <aside className="demo-page-note">
        <p>
          <strong>关于“原理演示”</strong>
          示例用来解释一类交互如何工作，不冒充关联工具的实际渲染或功能。动画会尊重系统的“减少动态效果”设置。
        </p>
        <a className="text-link" href="/">
          回到工具目录
        </a>
      </aside>
    </div>
  );
}
