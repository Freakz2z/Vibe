export function luminance(hex: string): number {
  const values = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
export function contrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function parseCSV(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) { quoted = false; closed = true; }
      else if (cell === '') quoted = true;
      else throw Error('引号只能从字段开头开始');
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; closed = false; }
    else if (char === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; closed = false; }
    else { if (closed) throw Error('引号结束后应为逗号或换行'); cell += char; }
  }
  if (quoted) throw Error('存在未闭合的引号');
  if (cell !== '' || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
export interface SortFrame { values: number[]; comparing: number[]; sorted: number[]; action: string; }
export function sortFrames(initial: number[], algorithm: string): SortFrame[] {
  const values = [...initial], frames: SortFrame[] = [];
  const push = (comparing: number[], sorted: number[], action: string) => frames.push({ values: [...values], comparing, sorted, action });
  push([], [], '初始数据');
  if (algorithm === 'bubble') {
    for (let end = values.length - 1; end > 0; end--) {
      for (let j = 0; j < end; j++) {
        const sorted = values.map((_, i) => i).filter(i => i > end);
        push([j, j + 1], sorted, `比较第 ${j + 1} 和 ${j + 2} 项`);
        if (values[j] > values[j + 1]) { [values[j], values[j + 1]] = [values[j + 1], values[j]]; push([j, j + 1], sorted, '交换位置'); }
      }
    }
  } else {
    for (let i = 1; i < values.length; i++) {
      let j = i;
      while (j > 0) {
        push([j - 1, j], Array.from({ length: i }, (_, k) => k), `将第 ${i + 1} 项插入前面的有序区域`);
        if (values[j - 1] <= values[j]) break;
        [values[j - 1], values[j]] = [values[j], values[j - 1]]; j--;
        push([j, j + 1], [], '向前交换位置');
      }
    }
  }
  push([], values.map((_, i) => i), '排序完成'); return frames;
}
export function noiseValue(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
