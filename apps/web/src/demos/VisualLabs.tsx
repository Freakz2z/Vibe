import { useEffect, useRef, useState } from 'react';
import { Lab, Range, Select, Code } from './LabControls';
import { noiseValue } from './lab-utils';
import type { DemoCopyHandler } from './types';

export function BezierLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [x1, setX1] = useState(.25), [y1, setY1] = useState(.1), [x2, setX2] = useState(.25), [y2, setY2] = useState(1), [duration, setDuration] = useState(1000);
  const ball = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), animation = useRef<Animation | null>(null);
  const curve = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  useEffect(() => { animation.current?.cancel(); return () => animation.current?.cancel(); }, [curve, duration]);
  const play = () => {
    animation.current?.cancel(); const distance = Math.max(0, (track.current?.clientWidth || 200) - 44);
    animation.current = ball.current!.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${distance}px)` }], { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration, easing: curve, fill: 'forwards' });
  };
  return <Lab title="贝塞尔缓动" reset={() => { setX1(.25); setY1(.1); setX2(.25); setY2(1); setDuration(1000); animation.current?.cancel(); }}><div className="lab-layout"><div className="lab-controls"><Range label="起点控制 X" value={x1} min={0} max={1} step={.05} onChange={setX1} /><Range label="起点控制 Y" value={y1} min={0} max={1} step={.05} onChange={setY1} /><Range label="终点控制 X" value={x2} min={0} max={1} step={.05} onChange={setX2} /><Range label="终点控制 Y" value={y2} min={0} max={1} step={.05} onChange={setY2} /><Range label="播放时长" value={duration} min={200} max={2400} step={100} unit="ms" onChange={setDuration} /><button className="button button--primary" onClick={play}>播放</button></div><div className="lab-stage"><svg className="lab-svg" viewBox="0 0 300 280" role="img" aria-label="时间与位移的三次贝塞尔曲线"><path d="M40 20 V240 H260" fill="none" stroke="var(--muted)" /><path d={`M40 240 L${40 + x1 * 220} ${240 - y1 * 220} M260 20 L${40 + x2 * 220} ${240 - y2 * 220}`} stroke="var(--muted)" strokeDasharray="4 4" /><path d={`M40 240 C${40 + x1 * 220} ${240 - y1 * 220} ${40 + x2 * 220} ${240 - y2 * 220} 260 20`} fill="none" stroke="var(--accent)" strokeWidth="4" />{[[x1, y1], [x2, y2]].map(([x, y], i) => <circle key={i} cx={40 + x * 220} cy={240 - y * 220} r="6" fill="var(--accent)" />)}<text x="140" y="270" fill="var(--muted)" fontSize="12">时间 →</text><text x="4" y="24" fill="var(--muted)" fontSize="12">位移</text></svg><div ref={track} className="lab-bezier-track"><div className="lab-bezier-ball" ref={ball} /></div></div></div><Code text={`transition: transform ${duration}ms ${curve};`} onCopy={onCopy} label="CSS" /></Lab>;
}
export function NoiseLab() {
  const [seed, setSeed] = useState(12), [scale, setScale] = useState(8), [layers, setLayers] = useState(3), [url, setUrl] = useState('');
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, context = canvas.getContext('2d'); if (!context) return;
    const image = context.createImageData(256, 256);
    const smooth = (v: number) => v * v * (3 - 2 * v);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      let value = 0, weight = 0;
      for (let layer = 0; layer < layers; layer++) {
        const frequency = scale * 2 ** layer / 256, px = x * frequency, py = y * frequency, ix = Math.floor(px), iy = Math.floor(py), fx = smooth(px - ix), fy = smooth(py - iy);
        const a = noiseValue(ix, iy, seed), b = noiseValue(ix + 1, iy, seed), c = noiseValue(ix, iy + 1, seed), d = noiseValue(ix + 1, iy + 1, seed);
        const amount = .5 ** layer; value += ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * amount; weight += amount;
      }
      const v = Math.round(value / weight * 255), i = (y * 256 + x) * 4;
      image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v; image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0); setUrl(canvas.toDataURL('image/png'));
  }, [seed, scale, layers]);
  return <Lab title="噪声纹理" reset={() => { setSeed(12); setScale(8); setLayers(3); }}><div className="lab-layout"><div className="lab-controls"><Range label="随机种子" value={seed} min={1} max={100} onChange={setSeed} /><Range label="采样尺度" value={scale} min={2} max={32} onChange={setScale} /><Range label="叠加图层" value={layers} min={1} max={5} onChange={setLayers} /><a className="button button--secondary" href={url} download={`vibe-noise-${seed}.png`}>下载 PNG</a><p className="demo-caption">用整数哈希生成格点值，再平滑插值并叠加。相同参数会得到相同纹理；这里实现的是值噪声。</p></div><div className="lab-stage lab-center"><canvas width="256" height="256" ref={ref} className="lab-noise" aria-label="生成的灰度噪声纹理" /></div></div></Lab>;
}
export function ImageLab() {
  const [source, setSource] = useState<HTMLImageElement | null>(null), [scale, setScale] = useState(75), [quality, setQuality] = useState(80), [format, setFormat] = useState('image/webp'), [error, setError] = useState(''), [inputBytes, setInputBytes] = useState(0);
  const [output, setOutput] = useState<{ url: string; bytes: number; width: number; height: number; mime: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), readSequence = useRef(0);
  useEffect(() => {
    if (!source) { setOutput(null); return; }
    let live = true; const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.naturalWidth * scale / 100)); canvas.height = Math.max(1, Math.round(source.naturalHeight * scale / 100));
    const context = canvas.getContext('2d'); if (!context) return;
    if (format === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL(format, quality / 100), mime = url.slice(5, url.indexOf(';'));
    canvas.toBlob(blob => { if (live && blob) setOutput({ url, bytes: blob.size, width: canvas.width, height: canvas.height, mime }); }, format, quality / 100);
    return () => { live = false; };
  }, [source, scale, quality, format]);
  const read = (file?: File) => {
    const sequence = ++readSequence.current; setError(''); setSource(null); setOutput(null); if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('请选择 10MB 以内的 PNG、JPEG 或 WebP 图片。'); return; }
    const reader = new FileReader(); reader.onerror = () => setError('图片读取失败'); reader.onload = () => {
      const image = new Image(); image.onload = () => { if (sequence !== readSequence.current) return; if (image.naturalWidth * image.naturalHeight > 20000000) { setError('图片像素超过 2000 万，请使用较小的图片。'); return; } setSource(image); setInputBytes(file.size); }; image.onerror = () => setError('无法解码这张图片'); image.src = String(reader.result);
    }; reader.readAsDataURL(file);
  };
  const extension = output?.mime === 'image/jpeg' ? 'jpg' : output?.mime === 'image/webp' ? 'webp' : 'png';
  return <Lab title="图片尺寸与压缩" reset={() => { readSequence.current++; setSource(null); setOutput(null); setError(''); setScale(75); setQuality(80); setFormat('image/webp'); if (inputRef.current) inputRef.current.value = ''; }}><div className="lab-layout"><div className="lab-controls"><label className="lab-field"><span>选择本地图片</span><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => read(e.target.files?.[0])} /></label><Range label="缩放比例" value={scale} min={10} max={100} unit="%" onChange={setScale} /><Select label="输出格式" value={format} onChange={setFormat} options={[["image/webp", "WebP"], ["image/jpeg", "JPEG"], ["image/png", "PNG"]]} />{format !== 'image/png' && <Range label="编码质量" value={quality} min={10} max={100} unit="%" onChange={setQuality} />}<p className="demo-caption">图片留在当前浏览器中。PNG 为无损编码，JPEG 的透明区域使用白色背景。</p></div><div className="lab-stage lab-image">{output ? <><img src={output.url} alt="处理后的本地图片预览" /><p role="status">{output.width} × {output.height} · {(output.bytes / 1024).toFixed(1)} KB<br />原文件 {(inputBytes / 1024).toFixed(1)} KB · {output.mime}</p><a className="button button--primary" download={`vibe-export.${extension}`} href={output.url}>下载图片</a></> : <p>选择图片后显示预览</p>}</div></div>{error && <p role="alert" className="lab-error">{error}</p>}</Lab>;
}
