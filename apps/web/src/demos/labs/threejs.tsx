import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabControls, Range, Stat, Stats, Status, useMotionOk, useThemeColors } from '../lab-kit';

/** Dynamic instancing: one geometry/material, a thousand individually animated matrices. */
export default function ThreejsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetView = useRef<() => void>(() => {});
  const playingRef = useRef(true), speedRef = useRef(1);
  const [count, setCount] = useState(1000);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(motionOk);
  const [metrics, setMetrics] = useState({ calls: 0, triangles: 0, interval: 0 });
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  playingRef.current = playing;
  speedRef.current = speed;
  useEffect(() => setPlaying(motionOk), [motionOk]);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
    catch (err) { setError(String(err)); return; }
    setError(null);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.surface || '#fffdf9');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x667799, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(4, 8, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8aaaff, 2);
    rim.position.set(-5, 2, -4); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.maxDistance = 45;
    controls.minDistance = 8;
    const geometry = new THREE.BoxGeometry(0.48, 0.48, 0.48);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.22 });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // A spherical lattice gives a legible silhouette at both portrait and landscape ratios.
    const positions: THREE.Vector3[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * (i + 0.5) / count;
      const radius = Math.sqrt(1 - y * y), angle = i * Math.PI * (3 - Math.sqrt(5));
      positions.push(new THREE.Vector3(Math.cos(angle) * radius * 4, y * 4, Math.sin(angle) * radius * 4));
      color.setHSL(0.52 + (y + 1) * 0.12, 0.68, 0.48 + (y + 1) * 0.06);
      mesh.setColorAt(i, color);
    }
    scene.add(mesh);
    const dummy = new THREE.Object3D();
    let phase = 0, raf = 0, last = 0, sampled = 0, frames = 0, elapsed = 0;
    const matrices = () => {
      for (let i = 0; i < count; i++) {
        dummy.position.copy(positions[i]).multiplyScalar(1 + Math.sin(phase + positions[i].y * 0.8) * 0.055);
        dummy.rotation.set(phase * 0.35 + i * 0.05, phase * 0.5 + i * 0.035, phase * 0.2);
        dummy.scale.setScalar(0.6 + 0.4 * Math.min(1, Math.sqrt(1000 / count)));
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    const render = () => {
      renderer.render(scene, camera);
      host.dataset.renderedInstances = String(mesh.count);
      host.dataset.drawCalls = String(renderer.info.render.calls);
    };
    const fit = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      const halfFov = Math.min(THREE.MathUtils.degToRad(21), Math.atan(Math.tan(THREE.MathUtils.degToRad(21)) * camera.aspect));
      const distance = 5.3 / Math.sin(halfFov);
      camera.position.set(0.55, 0.32, 1).normalize().multiplyScalar(distance);
      controls.target.set(0, 0, 0); controls.update(); controls.saveState(); render();
    };
    matrices(); fit();
    setMetrics({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, interval: 0 });
    resetView.current = () => { controls.reset(); render(); };
    controls.addEventListener('change', render);
    const observer = new ResizeObserver(fit); observer.observe(host);
    const tick = (now: number) => {
      const delta = last ? Math.min(100, now - last) : 0; last = now;
      if (playingRef.current) {
        phase += delta * 0.001 * speedRef.current;
        mesh.rotation.y = phase * 0.15;
        matrices(); render();
        elapsed += delta; frames++;
        if (now - sampled > 500 && frames > 1) {
          setMetrics({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, interval: elapsed / frames });
          sampled = now; elapsed = 0; frames = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); observer.disconnect(); controls.removeEventListener('change', render);
      controls.dispose(); geometry.dispose(); material.dispose(); mesh.dispose(); renderer.dispose();
      resetView.current = () => {};
    };
  }, [count, revision, colors.surface]);

  const snippet = useMemo(() => [
    `const mesh = new THREE.InstancedMesh(geometry, material, ${count});`,
    `mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);`,
    `for (let i = 0; i < mesh.count; i++) {`,
    `  dummy.position.copy(positions[i]);`,
    `  dummy.rotation.set(time * .35 + i * .05, time * .5, 0);`,
    `  dummy.updateMatrix();`,
    `  mesh.setMatrixAt(i, dummy.matrix);`,
    `}`, `mesh.instanceMatrix.needsUpdate = true;`,
    `renderer.render(scene, camera);`,
    `// 读取当前帧实际调用次数：renderer.info.render.calls`,
    `const controls = new OrbitControls(camera, renderer.domElement);`,
  ].join('\n'), [count]);
  return <Lab title="Three.js 实例化渲染" badge={<span className="demo-live-badge">three r169</span>} reset={() => {
    setCount(1000); setSpeed(1); setPlaying(motionOk); setRevision(n => n + 1);
  }}>
    <div className="lab-layout lab-layout--toolbar">
      <LabControls>
        <div data-lab-actions><Range label="实例数量" value={count} min={200} max={4000} step={100} onChange={setCount}/></div>
        <Range label="动画速度" value={speed} min={0.2} max={3} step={0.1} unit=" 倍" onChange={setSpeed}/>
        <div className="lab-options" data-lab-actions>
          <button className="button button--primary button--small" onClick={() => setPlaying(v => !v)}>{playing ? '暂停动画' : '播放动画'}</button>
          <button className="button button--secondary button--small" onClick={() => resetView.current()}>复位视角</button>
        </div>
        {!motionOk ? <Status>已暂停自动动画；仍可拖动旋转、双指缩放或手动播放。</Status> : null}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </LabControls>
      <div className="lab-stage">
        <div className="lab-three-viewport" ref={hostRef}>
          <canvas ref={canvasRef} className="lab-three-canvas" aria-label="可拖动的实例化立方体场景"/>
          <p className="lab-three-hint">拖动旋转 · 双指缩放</p>
          <p className="lab-three-axis">InstancedMesh × {count.toLocaleString('zh-CN')}</p>
        </div>
        <Stats><Stat label="实例" value={count.toLocaleString('zh-CN')}/><Stat label="绘制调用" value={metrics.calls}/><Stat label="三角形" value={metrics.triangles.toLocaleString('zh-CN')}/></Stats>
        <p className="lab-motion-note">{playing && metrics.interval > 0 ? `帧间隔 ${metrics.interval.toFixed(1)} ms · ` : ''}同一几何与材质，每个实例单独更新矩阵。绘制调用读取 renderer.info。</p>
      </div>
    </div>
    <Code text={snippet} onCopy={onCopy} label="Three.js 调用"/>
  </Lab>;
}
