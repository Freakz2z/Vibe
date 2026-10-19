import { useRef } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { formatUpdatedAt } from '../lib/catalog';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  updatedAt: string;
  toolCount: number;
  categoryCount: number;
  demoCount: number;
}

export function AboutDialog({
  open,
  onClose,
  updatedAt,
  toolCount,
  categoryCount,
  demoCount,
}: AboutDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(open, dialogRef, onClose);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="about-dialog__head">
          <p className="eyebrow">关于这本工具册</p>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭关于弹窗">
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <h2 id="about-dialog-title">关于 Vibe 工具集</h2>
        <p className="about-dialog__lede">
          给独立开发者与使用 AI 编程的创造者准备的一份中文工具目录。目标不是收集一切，而是把每个环节里值得先了解的选择放得足够清楚。
        </p>

        <div className="about-dialog__facts" aria-label="目录概况">
          <span>
            <strong>{toolCount}</strong> 个工具
          </span>
          <span>
            <strong>{categoryCount}</strong> 个分类
          </span>
          <span>
            <strong>{demoCount}</strong> 个站内示例
          </span>
          <span>整理于 {formatUpdatedAt(updatedAt)}</span>
        </div>

        <div className="about-dialog__sections">
          <section>
            <h3>选型时看什么</h3>
            <p>
              先按交付环境筛平台，再看维护方式和团队熟悉的生态。授权分为开源免费、免费使用、免费增值和付费四类：开源免费强调可获取源码，免费使用表示可免费使用但未必开放源码。具体套餐、许可和平台支持随时可能变化，请以官方页面为准。
            </p>
          </section>
          <section>
            <h3>收录与排序</h3>
            <p>
              这是一份人工整理的目录，没有实时 star 数、下载量或排行榜，也没有把付费收录作为排序依据。收录不代表推荐，我们也没有声称逐一实测过所有工具。
            </p>
          </section>
          <section>
            <h3>站内示例</h3>
            <p>
              六个交互示例均为本站独立实现的原理演示，用于说明交互方式，不加载或代表关联工具的实际运行结果。页面会明确标注“原理演示”。
            </p>
          </section>
          <section>
            <h3>本机数据</h3>
            <p>
              收藏与主题偏好保存在浏览器的 localStorage 中，不需要账号，也不会随请求上传。清除浏览器站点数据会一并移除收藏。本站不是任何工具的官方页面。
            </p>
          </section>
        </div>

        <div className="about-dialog__foot">
          <button type="button" className="button button--primary" onClick={onClose}>
            继续浏览
          </button>
        </div>
      </div>
    </div>
  );
}
