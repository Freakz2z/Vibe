import { LabControls } from '../lab-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Range, Status } from '../lab-kit';

interface BoxState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
}

/** The Moveable surface keeps a fixed logical size; at 320px it scrolls horizontally. */
const FIELD_W = 520;
const FIELD_H = 340;

const INITIAL: BoxState = { x: 40, y: 30, width: 170, height: 120, rotate: 0 };

/**
 * Moveable 0.56: real drag / resize / rotate handles attached to a real element.
 * Every readout comes from the Moveable event object itself.
 */
export default function MoveableLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  const [box, setBox] = useState<BoxState>(INITIAL);
  const [draggable, setDraggable] = useState(true);
  const [resizable, setResizable] = useState(true);
  const [rotatable, setRotatable] = useState(true);
  const [snap, setSnap] = useState(true);
  const [useGuidelines, setUseGuidelines] = useState(true);
  const [grid, setGrid] = useState(20);
  const [lastEvent, setLastEvent] = useState('—');

  const reset = useCallback(() => {
    setBox(INITIAL);
    setLastEvent('已重置');
  }, []);

  // Moveable measures the element itself; we only mirror the event values back onto
  // the element as a transform, so there is no layout feedback loop.
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    element.style.transform = `translate(${box.x}px, ${box.y}px) rotate(${box.rotate}deg)`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
  }, [box]);

  const snippet = `import Moveable from 'react-moveable';

<Moveable
  target={boxRef.current}
  draggable={draggable}
  resizable={resizable}
  rotatable={rotatable}
  snappable={${snap}}
  snapGridWidth={${grid}}
  snapGridHeight={${grid}}
  elementGuidelines={${useGuidelines} ? [guideRef.current] : []}
  bounds={{ left: 0, top: 0, right: ${FIELD_W}, bottom: ${FIELD_H} }}
  onDrag={(e) => setBox((b) => ({ ...b, x: e.left, y: e.top }))}
  onResize={(e) => setBox((b) => ({ ...b, width: e.width, height: e.height }))}
  onRotate={(e) => setBox((b) => ({ ...b, rotate: e.rotate }))}
/>`;

  return (
    <Lab title="Moveable 拖拽缩放旋转" badge={<span className="demo-live-badge">react-moveable 0.56</span>} reset={reset}>
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Range label="吸附网格" value={grid} min={5} max={50} step={5} unit=" px" onChange={setGrid} />
          <div className="lab-field">
            <span>可用的手柄</span>
            <div className="lab-checks">
              <label className="lab-option">
                <input type="checkbox" checked={draggable} onChange={(e) => setDraggable(e.target.checked)} />
                拖动
              </label>
              <label className="lab-option">
                <input type="checkbox" checked={resizable} onChange={(e) => setResizable(e.target.checked)} />
                缩放
              </label>
              <label className="lab-option">
                <input type="checkbox" checked={rotatable} onChange={(e) => setRotatable(e.target.checked)} />
                旋转
              </label>
              <label className="lab-option">
                <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
                网格吸附
              </label>
              <label className="lab-option">
                <input type="checkbox" checked={useGuidelines} onChange={(e) => setUseGuidelines(e.target.checked)} />
                元素参考线
              </label>
            </div>
          </div>
          <Status>x / y / 宽 / 高 / 角度全部来自 Moveable 的指针事件对象，不是自己累加的。</Status>
        </LabControls>

        <div className="lab-stage">
          <div className="lab-moveable-scroll">
            <div className="lab-moveable-canvas" style={{ width: FIELD_W, height: FIELD_H }}>
              <div ref={guideRef} className="lab-move-guide" />
              <div ref={boxRef} className="lab-moveable-box">
                <strong>可拖动</strong>
                <small>
                  {Math.round(box.width)} × {Math.round(box.height)}
                </small>
              </div>
              <div className="lab-moveable-mount">
                <Moveable
                  ref={moveableRef}
                  target={boxRef.current}
                  draggable={draggable}
                  resizable={resizable}
                  rotatable={rotatable}
                  snappable={snap}
                  snapGridWidth={snap ? grid : 0}
                  snapGridHeight={snap ? grid : 0}
                  elementGuidelines={useGuidelines && guideRef.current ? [guideRef.current] : []}
                  bounds={{ left: 0, top: 0, right: FIELD_W, bottom: FIELD_H }}
                  onDragStart={() => setLastEvent('onDragStart')}
                  onDrag={(event) => {
                    setBox((current) => ({ ...current, x: event.left, y: event.top }));
                    setLastEvent('onDrag');
                  }}
                  onResizeStart={() => setLastEvent('onResizeStart')}
                  onResize={(event) => {
                    setBox((current) => ({ ...current, width: event.width, height: event.height }));
                    setLastEvent('onResize');
                  }}
                  onRotateStart={() => setLastEvent('onRotateStart')}
                  onRotate={(event) => {
                    setBox((current) => ({ ...current, rotate: event.rotate }));
                    setLastEvent('onRotate');
                  }}
                />
              </div>
              <p className="lab-move-hint">蓝色竖线是 elementGuidelines 的参考线，靠近时手柄会吸上去</p>
            </div>
          </div>

          <dl className="lab-readout">
            <div>
              <dt>x / y</dt>
              <dd>
                {Math.round(box.x)} / {Math.round(box.y)}
              </dd>
            </div>
            <div>
              <dt>宽 / 高</dt>
              <dd>
                {Math.round(box.width)} / {Math.round(box.height)}
              </dd>
            </div>
            <div>
              <dt>旋转</dt>
              <dd>{Math.round(box.rotate)}°</dd>
            </div>
            <div>
              <dt>最近事件</dt>
              <dd>{lastEvent}</dd>
            </div>
          </dl>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Moveable 用法" maxHeight={280} />
    </Lab>
  );
}
