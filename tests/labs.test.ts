import test from 'node:test';
import assert from 'node:assert/strict';
import {contrast,parseCSV,sortFrames,noiseValue} from '../apps/web/src/demos/lab-utils';

test('contrast uses sRGB gamma and is symmetric',()=>{
 assert.equal(contrast('#000000','#ffffff'),21);
 assert.equal(contrast('#ffffff','#ffffff'),1);
 assert(Math.abs(contrast('#777777','#ffffff')-4.478089)<.00001);
 assert.equal(contrast('#ff0033','#fff8e0'),contrast('#fff8e0','#ff0033'));
});
test('CSV preserves escaped quotes, delimiters, embedded newlines and empty final cells',()=>{
 assert.deepEqual(parseCSV('\uFEFFname,note\r\nReact,"a,b"\r\nVue,"a""b\nc"\r\nlast,'),[['name','note'],['React','a,b'],['Vue','a"b\nc'],['last','']]);
 assert.throws(()=>parseCSV('a,"unterminated'));
 assert.deepEqual(parseCSV('""'),[['']]);
 assert.throws(()=>parseCSV('a,"quoted"trailing'));
});
test('both sorting traces conserve the multiset and end sorted',()=>{
 for(const algorithm of ['bubble','insertion']){
  const initial=[4,1,3,1,-2,0];const frames=sortFrames(initial,algorithm);const sorted=[...initial].sort((a,b)=>a-b);
  assert.deepEqual(frames.at(-1)?.values,sorted);assert.deepEqual(initial,[4,1,3,1,-2,0]);
  for(const f of frames)assert.deepEqual([...f.values].sort((a,b)=>a-b),sorted);
 }
});
test('noise hashes are deterministic, seed-sensitive and bounded',()=>{
 for(let i=0;i<100;i++)assert(noiseValue(i,i*3,5)>=0&&noiseValue(i,i*3,5)<=1);
 assert.equal(noiseValue(1,2,3),noiseValue(1,2,3));assert.notEqual(noiseValue(1,2,3),noiseValue(1,2,4));
});
