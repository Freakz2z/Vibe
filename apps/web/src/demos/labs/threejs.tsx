import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, Range, Stat, Stats, Status, useAnimationFrame, useMotionOk, useThemeColors } from '../lab-kit';

interface OrbitState {
  theta: number;
  phi: number;
  dragging: boolean;
  startTheta: number;
  startPhi: number;
  lastX: number;
  lastY: number;
}

// Types come from the official `@types/three` package, so the scene handles are
// the real Three.js classes and a wrong API call fails the type check.
interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  mesh: THREE.InstancedMesh;
  seeds: Float32Array;
  matrix: THREE.Matrix4;
  camera: THREE.PerspectiveCamera;
}

/** Three.js：真实 WebGL 场景，InstancedMesh + setMatrixAt，灯光与自写指针轨道相机。 */
export default function ThreejsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const orbitRef = useRef<OrbitState>({ theta: 0.7, phi: 1.15, dragging: false, startTheta: 0, startPhi: 0, lastX: 0, lastY: 0 });
  const speedRef = useRef(1);
  const autoRef = useRef(true);
  const frameRef = useRef({ ms: 16.7, spin: 0 });

  const [count, setCount] = useState(1400);
  const [speed, setSpeed] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [frameMs, setFrameMs] = useState(16.7);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  speedRef.current = speed;
  autoRef.current = autoRotate;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法创建 WebGL 渲染器');
      return;
    }
    setError(null);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const surface = colors.surface ?? '#fffdf9';
    renderer.setClearColor(new THREE.Color(surface), 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(surface);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 0, 0);

    const accent = new THREE.Color(colors.accent ?? '#d95a3f');
    const line = new THREE.Color(colors['line-strong'] ?? '#cfc4bb');

    scene.add(new THREE.AmbientLight(new THREE.Color(colors.ink ?? '#1c1b19'), 0.8));
    const key = new THREE.DirectionalLight(new THREE.Color(colors['accent-strong'] ?? '#b8432b'), 2.2);
    key.position.set(6, 9, 4);
    scene.add(key);
    const fillLight = new THREE.DirectionalLight(new THREE.Color(colors.muted ?? '#6b6459'), 0.6);
    fillLight.position.set(-7, -4, -6);
    scene.add(fillLight);

    const geometry = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.12 });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const seeds = new Float32Array(count * 4);
    const tmpColor = new THREE.Color();
    const initialMatrix = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) {
      const a = (i * 0.6180339887) % 1;
      const b = (i * 0.7548776662) % 1;
      const c = (i * 0.5698402909) % 1;
      seeds[i * 4 + 0] = (a - 0.5) * 13;
      seeds[i * 4 + 1] = (b - 0.5) * 9;
      seeds[i * 4 + 2] = (c - 0.5) * 7;
      seeds[i * 4 + 3] = 0.55 + a * 0.9;
      tmpColor.copy(line).lerp(accent, b * 0.85 + 0.1);
      mesh.setColorAt(i, tmpColor);
      initialMatrix.makeScale(seeds[i * 4 + 3], seeds[i * 4 + 3], seeds[i * 4 + 3]);
      initialMatrix.setPosition(seeds[i * 4], seeds[i * 4 + 1], seeds[i * 4 + 2]);
      mesh.setMatrixAt(i, initialMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    const matrix = new THREE.Matrix4();
    sceneRef.current = { renderer, scene, mesh, seeds, matrix, camera };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // Minimal pointer-drag orbit, hand-written: no OrbitControls, no extra import.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const o = orbitRef.current;
      o.dragging = true;
      o.startTheta = o.theta;
      o.startPhi = o.phi;
      o.lastX = event.clientX;
      o.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const o = orbitRef.current;
      if (!o.dragging) return;
      o.theta = o.startTheta - (event.clientX - o.lastX) * 0.006;
      o.phi = Math.min(Math.PI - 0.15, Math.max(0.15, o.startPhi - (event.clientY - o.lastY) * 0.006));
    };
    const endDrag = (event: PointerEvent) => {
      orbitRef.current.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // Static frame so the scene is visible even when the loop is paused.
    renderer.render(scene, camera);
    host.dataset.renderedInstances = String(mesh.count);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      observer.disconnect();
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      mesh.dispose();
      renderer.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, nonce, colors.surface, colors.accent, colors.ink, colors.muted, colors['accent-strong'], colors['line-strong']]);

  const scaleVec = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useAnimationFrame(motionOk, (_now, dtMs) => {
    const current = sceneRef.current;
    if (!current) return;
    const { mesh, seeds, matrix, camera, renderer, scene } = current;
    const o = orbitRef.current;

    frameRef.current.spin += dtMs * 0.0011 * speedRef.current;
    const t = frameRef.current.spin;

    if (autoRef.current && !o.dragging) o.theta += dtMs * 0.0004 * speedRef.current;

    const radius = 16;
    camera.position.set(radius * Math.sin(o.phi) * Math.sin(o.theta), radius * Math.cos(o.phi), radius * Math.sin(o.phi) * Math.cos(o.theta));
    camera.lookAt(0, 0, 0);

    for (let i = 0; i < mesh.count; i += 1) {
      const sx = seeds[i * 4 + 0];
      const sy = seeds[i * 4 + 1];
      const sz = seeds[i * 4 + 2];
      const s = seeds[i * 4 + 3];
      matrix.makeRotationY(t + i * 0.017);
      matrix.setPosition(sx + Math.sin(t * 0.6 + i) * 0.18, sy + Math.cos(t * 0.8 + i * 0.5) * 0.22, sz);
      scaleVec.set(s, s, s);
      matrix.scale(scaleVec);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);

    const ms = frameRef.current.ms * 0.9 + dtMs * 0.1;
    frameRef.current.ms = ms;
    setFrameMs(ms);
  });

  const snippet = useMemo(
    () =>
      [
        `import * as THREE from 'three';`,
        ``,
        `const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });`,
        `renderer.setPixelRatio(Math.min(devicePixelRatio, 2));`,
        ``,
        `// ${count} 个方块共用一份 geometry / material，由 InstancedMesh 一次绘制`,
        `const mesh = new THREE.InstancedMesh(geometry, material, ${count});`,
        `mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);`,
        ``,
        `// 每帧写入矩阵：makeRotationY -> setPosition -> scale，最后整体上传`,
        `for (let i = 0; i < mesh.count; i++) {`,
        `  matrix.makeRotationY(t + i * 0.017);`,
        `  matrix.setPosition(x + Math.sin(t * 0.6 + i) * 0.18, y, z);`,
        `  matrix.scale(scaleVec);`,
        `  mesh.setMatrixAt(i, matrix);`,
        `}`,
        `mesh.instanceMatrix.needsUpdate = true;`,
        ``,
        `// 灯光：环境光 + 主方向光 + 补光，颜色取自主题 CSS 变量`,
        `scene.add(new THREE.AmbientLight(ink, 0.8));`,
        `const key = new THREE.DirectionalLight(accentStrong, 2.2); key.position.set(6, 9, 4);`,
        ``,
        `// 轨道相机是自己写的 pointer 事件，不是 OrbitControls`,
        `canvas.addEventListener('pointermove', (e) => { if (dragging) theta -= (e.clientX - lastX) * 0.006; });`,
        ``,
        `// 卸载：事件 / 观察器 / 几何 / 材质 / 实例缓冲 / 渲染器全部释放`,
        `geometry.dispose(); material.dispose(); mesh.dispose(); renderer.dispose();`,
      ].join('\n'),
    [count],
  );

  return (
    <Lab
      title="Three.js 实例化渲染"
      badge={<span className="demo-live-badge">three r169</span>}
      reset={() => {
        orbitRef.current = { theta: 0.7, phi: 1.15, dragging: false, startTheta: 0, startPhi: 0, lastX: 0, lastY: 0 };
        setCount(1400);
        setSpeed(1);
        setAutoRotate(true);
        setNonce((n) => n + 1);
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Range label="实例数量" value={count} min={200} max={4000} step={100} onChange={setCount} hint="改数量会重建 InstancedMesh 并重新分配实例缓冲。" />
          <Range label="动画速度" value={speed} min={0} max={4} step={0.1} unit=" 倍" onChange={setSpeed} />
          <div className="lab-options">
            <label>
              <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
              自动旋转
            </label>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const o = orbitRef.current;
                o.theta = 0.7;
                o.phi = 1.15;
              }}
            >
              复位视角
            </button>
          </div>
          {!motionOk ? <Status>系统开启了「减少动态效果」，渲染循环已停止；场景仍绘制一帧，拖动视角依然可用。</Status> : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Stats>
            <Stat label="实例" value={count.toLocaleString('zh-CN')} />
            <Stat label="实测帧耗时" value={`${frameMs.toFixed(1)} ms`} />
          </Stats>
          <p className="lab-motion-note">帧耗时是本机 requestAnimationFrame 间隔的指数滑动平均，含提交与合成开销，不是渲染器内部的数字。</p>
        </LabControls>

        <div className="lab-stage">
          <div className="lab-three-viewport" ref={hostRef}>
            <canvas ref={canvasRef} className="lab-three-canvas" aria-label="可拖动的实例化立方体场景" />
            <p className="lab-three-hint">按住画布拖动即可旋转视角</p>
            <p className="lab-three-axis">InstancedMesh × {count.toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Three.js 调用" maxHeight={340} />
    </Lab>
  );
}
