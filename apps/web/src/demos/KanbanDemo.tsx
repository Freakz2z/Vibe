import { useRef, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw } from 'lucide-react';

type ColumnId = 'backlog' | 'progress' | 'done';

interface BoardTask {
  id: string;
  title: string;
  tag: string;
}

const COLUMNS: { id: ColumnId; name: string }[] = [
  { id: 'backlog', name: '待整理' },
  { id: 'progress', name: '进行中' },
  { id: 'done', name: '已完成' },
];

const INITIAL_BOARD: Record<ColumnId, BoardTask[]> = {
  backlog: [
    { id: 'nav', title: '梳理导航信息架构', tag: '内容' },
    { id: 'motion', title: '对比两个动效方案', tag: '动效' },
    { id: 'empty', title: '补全登录空状态', tag: '界面' },
  ],
  progress: [{ id: 'filter', title: '调整移动端筛选栏', tag: '界面' }],
  done: [{ id: 'a11y', title: '收集无障碍检查清单', tag: '工程' }],
};

function cloneBoard(): Record<ColumnId, BoardTask[]> {
  return {
    backlog: INITIAL_BOARD.backlog.map((task) => ({ ...task })),
    progress: INITIAL_BOARD.progress.map((task) => ({ ...task })),
    done: INITIAL_BOARD.done.map((task) => ({ ...task })),
  };
}

function columnName(id: ColumnId): string {
  return COLUMNS.find((column) => column.id === id)?.name ?? id;
}

export function KanbanDemo() {
  const [board, setBoard] = useState<Record<ColumnId, BoardTask[]>>(cloneBoard);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const dragRef = useRef<{ task: BoardTask; from: ColumnId } | null>(null);

  const moveTask = (task: BoardTask, from: ColumnId, to: ColumnId) => {
    if (from === to) return;
    setBoard((current) => {
      const currentTask = current[from].find((item) => item.id === task.id);
      if (!currentTask) return current;
      return {
        ...current,
        [from]: current[from].filter((item) => item.id !== task.id),
        [to]: [...current[to], currentTask],
      };
    });
    setAnnouncement(`已将「${task.title}」移到「${columnName(to)}」。`);
  };

  const moveFromButton = (task: BoardTask, from: ColumnId, direction: -1 | 1) => {
    const index = COLUMNS.findIndex((column) => column.id === from);
    const target = COLUMNS[index + direction];
    if (!target) return;
    moveTask(task, from, target.id);
  };

  const reset = () => {
    setBoard(cloneBoard());
    setDraggingId(null);
    setOverColumn(null);
    dragRef.current = null;
    setAnnouncement('任务板已重置。');
  };

  return (
    <section className="demo-workspace kanban-demo" aria-label="跨列拖拽原理演示">
      <div className="demo-toolbar">
        <div>
          <span className="demo-live-badge">本地交互</span>
          <h2>把卡片挪到合适的列</h2>
        </div>
        <button type="button" className="button button--quiet button--small" onClick={reset}>
          <RotateCcw size={14} aria-hidden="true" />
          重置看板
        </button>
      </div>

      <p className="kanban-help" id="kanban-help">
        <GripVertical size={15} aria-hidden="true" />
        桌面端可直接拖动卡片；触屏或键盘操作时，使用每张卡片下方的移动按钮。
      </p>

      <div className="kanban-board">
        {COLUMNS.map((column, columnIndex) => (
          <section
            className={`kanban-column${overColumn === column.id ? ' is-over' : ''}`}
            key={column.id}
            aria-labelledby={`kanban-${column.id}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOverColumn(column.id);
            }}
            onDragLeave={(event) => {
              if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
              setOverColumn((current) => (current === column.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              const drag = dragRef.current;
              if (drag) moveTask(drag.task, drag.from, column.id);
              dragRef.current = null;
              setDraggingId(null);
              setOverColumn(null);
            }}
          >
            <header className="kanban-column__head">
              <h3 id={`kanban-${column.id}`}>{column.name}</h3>
              <span>{board[column.id].length}</span>
            </header>

            <div className="kanban-column__cards">
              {board[column.id].map((task) => (
                <article
                  className={`kanban-card${draggingId === task.id ? ' is-dragging' : ''}`}
                  key={task.id}
                  draggable
                  onDragStart={(event: DragEvent<HTMLElement>) => {
                    dragRef.current = { task, from: column.id };
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', task.id);
                    setDraggingId(task.id);
                  }}
                  onDragEnd={() => {
                    dragRef.current = null;
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                >
                  <div className="kanban-card__top">
                    <GripVertical size={14} aria-hidden="true" />
                    <span className="kanban-card__tag">{task.tag}</span>
                  </div>
                  <p>{task.title}</p>
                  <div className="kanban-card__moves">
                    <button
                      type="button"
                      disabled={columnIndex === 0}
                      draggable={false}
                      onClick={() => moveFromButton(task, column.id, -1)}
                      aria-label={
                        columnIndex === 0
                          ? `「${task.title}」已在首列`
                          : `将「${task.title}」移到${COLUMNS[columnIndex - 1].name}`
                      }
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      {COLUMNS[columnIndex - 1]?.name ?? '已是首列'}
                    </button>
                    <button
                      type="button"
                      disabled={columnIndex === COLUMNS.length - 1}
                      draggable={false}
                      onClick={() => moveFromButton(task, column.id, 1)}
                      aria-label={
                        columnIndex === COLUMNS.length - 1
                          ? `「${task.title}」已在末列`
                          : `将「${task.title}」移到${COLUMNS[columnIndex + 1].name}`
                      }
                    >
                      {COLUMNS[columnIndex + 1]?.name ?? '已是末列'}
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
              {board[column.id].length === 0 ? (
                <p className="kanban-empty">拖一张卡片到这里</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <p className="demo-caption">
        任务板只在当前页面中存在，刷新后恢复初始样例。拖动使用浏览器原生事件，移动按钮提供不依赖指针的操作路径。
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
