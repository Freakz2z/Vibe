import { LabControls } from '../lab-kit';
import { useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Stat, Stats } from '../lab-kit';

interface Card {
  id: string;
  title: string;
}

const COLUMN_IDS = ['todo', 'doing', 'done'] as const;
type ColumnId = (typeof COLUMN_IDS)[number];

const COLUMN_TITLES: Record<ColumnId, string> = { todo: '待办', doing: '进行中', done: '完成' };

const SEED_CARDS: Record<string, Card> = {
  c1: { id: 'c1', title: '定义 layoutId 语义' },
  c2: { id: 'c2', title: '补齐键盘拖拽提示' },
  c3: { id: 'c3', title: '实例矩阵复用' },
  c4: { id: 'c4', title: '合批纹理去重' },
  c5: { id: 'c5', title: '刚体休眠阈值' },
  c6: { id: 'c6', title: '布尔路径缓存' },
  c7: { id: 'c7', title: '时间轴 seek 精度' },
  c8: { id: 'c8', title: '吸附点重算' },
};

const SEED_COLUMNS: Record<ColumnId, string[]> = {
  todo: ['c1', 'c2', 'c3', 'c7'],
  doing: ['c4', 'c5'],
  done: ['c6', 'c8'],
};

function SortableCard({ id, card }: { id: string; card: Card }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className="lab-dnd-card"
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span>{card.title}</span>
      <button type="button" ref={setActivatorNodeRef} className="lab-dnd-handle" {...attributes} {...listeners} aria-label={`拖动 ${card.title}`}><GripVertical size={18} aria-hidden="true" /></button>
    </div>
  );
}

function Column({ id, items, cards }: { id: ColumnId; items: string[]; cards: Record<string, Card> }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section className="lab-dnd-col" aria-label={COLUMN_TITLES[id]}>
      <header className="lab-dnd-col__head">
        <span>{COLUMN_TITLES[id]}</span>
        <span>{items.length}</span>
      </header>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="lab-dnd-col__list" ref={setNodeRef} style={isOver ? { outline: '2px dashed var(--accent)', outlineOffset: 2 } : undefined}>
          {items.map((itemId) => {
            const card = cards[itemId];
            return card ? <SortableCard key={itemId} id={itemId} card={card} /> : null;
          })}
        </div>
      </SortableContext>
    </section>
  );
}

/** dnd-kit：三列跨列排序看板，PointerSensor + KeyboardSensor（sortableKeyboardCoordinates）。 */
export default function DndKitLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [cards, setCards] = useState<Record<string, Card>>(SEED_CARDS);
  const [columns, setColumns] = useState<Record<ColumnId, string[]>>(SEED_COLUMNS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef(columns);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (target: string | number): ColumnId | null => {
    if ((COLUMN_IDS as readonly string[]).includes(String(target))) return target as ColumnId;
    for (const id of COLUMN_IDS) if (columns[id].includes(String(target))) return id;
    return null;
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    snapshot.current = columns;
    setActiveId(String(active.id));
  };
  const cancelDrag = () => {
    setColumns(snapshot.current);
    setActiveId(null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const next: Record<ColumnId, string[]> = { ...prev, [from]: prev[from].filter((x) => x !== active.id), [to]: [...prev[to]] };
      const overIndex = next[to].indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : next[to].length;
      next[to].splice(insertAt, 0, String(active.id));
      return next;
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) { cancelDrag(); return; }
    setActiveId(null);
    const column = findColumn(over.id);
    if (!column) return;
    const fromIndex = columns[column].indexOf(String(active.id));
    const toIndex = columns[column].indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    setColumns((prev) => ({ ...prev, [column]: arrayMove(prev[column], fromIndex, toIndex) }));
  };

  const total = COLUMN_IDS.reduce((sum, id) => sum + columns[id].length, 0);
  const activeCard = activeId ? cards[activeId] : null;

  const snippet = useMemo(
    () =>
      [
        `import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors, useDroppable } from '@dnd-kit/core';`,
        `import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';`,
        `import { CSS } from '@dnd-kit/utilities';`,
        ``,
        `const sensors = useSensors(`,
        `  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),`,
        `  // 键盘传感器 + 坐标计算器：无障碍拖拽的关键`,
        `  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),`,
        `);`,
        ``,
        `<DndContext sensors={sensors} collisionDetection={closestCorners}`,
        `  onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>`,
        `  {/* 每列一个 SortableContext，列容器本身用 useDroppable 接收空列的投放 */}`,
        `  <SortableContext items={columnItems} strategy={verticalListSortingStrategy}>`,
        `    <div ref={setNodeRef} className="lab-dnd-col__list">{cards}</div>`,
        `  </SortableContext>`,
        `  <DragOverlay>{activeCard}</DragOverlay>`,
        `</DndContext>`,
        ``,
        `// useSortable 给出的 transform 要原样交给 CSS`,
        `style={{ transform: CSS.Transform.toString(transform), transition }}`,
      ].join('\n'),
    [],
  );

  return (
    <Lab
      title="dnd-kit 排序看板"
      badge={<span className="demo-live-badge">@dnd-kit 6 / 10</span>}
      reset={() => {
        setCards(SEED_CARDS);
        setColumns(SEED_COLUMNS);
        setActiveId(null);
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <div className="lab-options">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setColumns((prev) => ({ ...prev, todo: prev.todo.slice().reverse() }))}
            >
              反转待办列
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() =>
                setColumns(() => ({
                  todo: ['c1', 'c2'],
                  doing: ['c3', 'c4', 'c5'],
                  done: ['c6', 'c7', 'c8'],
                }))
              }
            >
              重新分布
            </button>
          </div>
          <Stats>
            <Stat label="卡片总数" value={total} />
            <Stat label="列数" value={COLUMN_IDS.length} />
          </Stats>
          <p className="lab-motion-note">
            <strong>键盘也能拖：</strong>用 Tab 聚焦拖动手柄，按空格（或回车）拿起，方向键移动，空格放下，Esc 取消。触屏按住手柄拖动，卡片正文区域可滚动。
            这是 KeyboardSensor + sortableKeyboardCoordinates 提供的真实能力，不是自绘的快捷键。
          </p>
        </LabControls>

        <div className="lab-stage">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={cancelDrag}
          >
            <div className="lab-dnd-board">
              {COLUMN_IDS.map((id) => (
                <Column key={id} id={id} items={columns[id]} cards={cards} />
              ))}
            </div>
            <DragOverlay>{activeCard ? <div className="lab-dnd-overlay">{activeCard.title}</div> : null}</DragOverlay>
          </DndContext>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="dnd-kit 调用" maxHeight={340} />
    </Lab>
  );
}
