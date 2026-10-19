/// <reference types="vite/client" />
import {useEffect, useMemo, useRef, useState} from 'react';
import {Map as GLMap, NavigationControl, Popup, setWorkerUrl} from 'maplibre-gl';
import type {GeoJSONSource, StyleSpecification, FilterSpecification, ExpressionSpecification} from 'maplibre-gl';
import workerURL from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/maps.css';
import type {DemoCopyHandler} from '../types';
import {Code, ErrorNote, Lab, LabLayout, Range, Select, Stats, Stat, Status, useThemeColors} from '../lab-kit';
import {CONTINENTS, MAPLIBRE_GEOJSON_URL, continentLabel, formatPopShort, loadCountries, type LoadedCountries, type CountryFeature} from '../maps-geo';

type PaintMode='continent'|'population';
const EMPTY:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[]};
const filterFor=(continent:string):FilterSpecification=>continent==='全部'?['has','continent']:['==',['get','continent'],continent];
const countryBounds=(f:CountryFeature):[number,number,number,number]=>{
 const box:[number,number,number,number]=[180,85,-180,-85];
 const walk=(p:unknown)=>{if(!Array.isArray(p))return;if(typeof p[0]==='number'&&typeof p[1]==='number'){box[0]=Math.min(box[0],p[0]);box[1]=Math.min(box[1],Math.max(-85,p[1]));box[2]=Math.max(box[2],p[0]);box[3]=Math.max(box[3],Math.min(85,p[1]));}else p.forEach(walk);};
 if('coordinates' in f.geometry)walk(f.geometry.coordinates);return box;
};

export default function MapLibreLab({onCopy}:{onCopy:DemoCopyHandler}){
 const colors=useThemeColors();
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<GLMap|null>(null),popup=useRef<Popup|null>(null);
 const [data,setData]=useState<LoadedCountries|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(false);
 const [continent,setContinent]=useState('全部'),[mode,setMode]=useState<PaintMode>('continent'),[zoom,setZoom]=useState(0.5),[bearing,setBearing]=useState(0),[selected,setSelected]=useState<CountryFeature|null>(null);
 const colorsRef=useRef(colors);colorsRef.current=colors;
 useEffect(()=>{
  const controller=new AbortController();setError('');
  loadCountries(MAPLIBRE_GEOJSON_URL,controller.signal).then(v=>{if(!controller.signal.aborted)setData(v);}).catch(e=>{if(!controller.signal.aborted)setError(String(e));});
  return()=>controller.abort();
 },[attempt]);
 useEffect(()=>{
  if(!host.current)return;
  setWorkerUrl(new URL(workerURL,window.location.href).href);
  const style:StyleSpecification={version:8,sources:{countries:{type:'geojson',data:EMPTY,promoteId:'id'}},layers:[
   {id:'background',type:'background',paint:{'background-color':colorsRef.current['surface-2']??'#f0ebe3'}},
   {id:'countries',type:'fill',source:'countries',paint:{'fill-color':'#d95a3f','fill-opacity':0.78}},
   {id:'borders',type:'line',source:'countries',paint:{'line-color':colorsRef.current.ink??'#211f1b','line-width':0.5,'line-opacity':0.5}},
   {id:'selection',type:'line',source:'countries',filter:['==',['get','id'],''],paint:{'line-color':colorsRef.current.ink??'#211f1b','line-width':2.5}},
  ]};
  let map:GLMap;
  try{map=new GLMap({container:host.current,style,center:[10,15],zoom:0.5,renderWorldCopies:false,attributionControl:{compact:true}});}catch(e){setError(String(e));return;}
  mapRef.current=map;map.addControl(new NavigationControl(),'top-right');
  map.on('load',()=>setReady(true));
  map.on('idle',()=>{host.current?.setAttribute('data-rendered-features', String(map.queryRenderedFeatures({layers:['countries']}).length));});
  map.on('move',()=>{setZoom(map.getZoom());setBearing(map.getBearing());});
  map.on('error',e=>setError(e.error.message));
  map.on('mouseenter','countries',()=>{map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave','countries',()=>{map.getCanvas().style.cursor='';});
  map.on('click','countries',e=>{
   const f=e.features?.[0];if(!f?.properties)return;
   const p=f.properties;
   const node=document.createElement('div');node.className='lab-maplibre-popup-name';node.textContent=`${p.name} · ${continentLabel(p.continent)} · 估计人口 ${formatPopShort(Number(p.pop))}`;
   popup.current?.remove();popup.current=new Popup().setLngLat(e.lngLat).setDOMContent(node).addTo(map);
   map.setFilter('selection',['==',['get','id'],String(p.id)]);
   setSelected({type:'Feature',geometry:f.geometry,properties:{name:String(p.name),continent:String(p.continent),pop:Number(p.pop),iso:String(p.iso),id:String(p.id)}});
  });
  const observer=new ResizeObserver(()=>map.resize());observer.observe(host.current);
  return()=>{observer.disconnect();popup.current?.remove();map.remove();mapRef.current=null;setReady(false);};
 },[]);
 useEffect(()=>{
  const map=mapRef.current;if(!ready||!map||!data)return;
  (map.getSource('countries') as GeoJSONSource).setData(data.collection);
 },[ready,data]);
 useEffect(()=>{
  const map=mapRef.current;if(!ready||!map)return;
  const ramp:ExpressionSpecification=mode==='continent'?['match',['get','continent'],'Africa','#dc886c','Asia','#d2a348','Europe','#769bba','North America','#a48ac1','South America','#7eac88','Oceania','#69a6ad','#a9a6a0']:['interpolate',['linear'],['ln',['max',1,['get','pop']]],0,'#f0d9cf',Math.log(1_500_000_000),'#a92f20'];
  map.setPaintProperty('countries','fill-color',ramp);
  map.setPaintProperty('background','background-color',colors['surface-2']??'#f0ebe3');
  map.setPaintProperty('borders','line-color',colors.ink??'#211f1b');map.setPaintProperty('selection','line-color',colors.ink??'#211f1b');
  map.setFilter('countries',filterFor(continent));map.setFilter('borders',filterFor(continent));
 },[ready,mode,continent,colors]);
 const visible=useMemo(()=>data?.features.filter(f=>continent==='全部'||f.properties.continent===continent)??[],[data,continent]);
 const focus=(iso:string)=>{const f=visible.find(f=>f.properties.id===iso),map=mapRef.current;if(!f||!map)return;setSelected(f);map.setFilter('selection',['==',['get','id'],iso]);map.fitBounds(countryBounds(f),{padding:28,maxZoom:4,duration:0});};
 return <Lab title="MapLibre 世界地图与数据样式" badge={<span className="demo-live-badge">MapLibre GL 6.15</span>} reset={()=>{setContinent('全部');setMode('continent');setSelected(null);popup.current?.remove();mapRef.current?.setFilter('selection',['==',['get','id'],'']);mapRef.current?.jumpTo({center:[10,15],zoom:0.5,bearing:0,pitch:0});}}>
  <LabLayout controls={<>
   <Select label="洲过滤" value={continent} onChange={v=>{setContinent(v);setSelected(null);mapRef.current?.setFilter('selection',['==',['get','id'],'']);}} options={CONTINENTS.map(c=>[c,continentLabel(c)])}/>
   <Select<PaintMode> label="数据样式" value={mode} onChange={setMode} options={[["continent","洲分类"],["population","估计人口色阶"]]}/>
   <Range label="缩放级别" min={0} max={6} step={0.1} value={Math.round(zoom*10)/10} onChange={v=>mapRef.current?.setZoom(v)}/>
   <Range label="相机方位" min={-180} max={180} step={1} value={Math.round(bearing)} unit="°" onChange={v=>mapRef.current?.setBearing(v)}/>
   <label className="lab-field"><span>定位国家</span><select aria-label="定位国家" value={selected?.properties.id??''} onChange={e=>focus(e.target.value)}><option value="">选择国家</option>{[...visible].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'zh')).map(f=><option key={f.properties.id} value={f.properties.id}>{f.properties.name}</option>)}</select></label>
   <Status>Natural Earth 数据快照；人口为源数据估计值，非实时统计。</Status>
  </>}>
   {error?<ErrorNote onRetry={()=>setAttempt(n=>n+1)}>{error}</ErrorNote>:null}
   <div className="lab-maplibre-map" ref={host} role="img" aria-label="MapLibre 世界国家边界"/>
   <Stats><Stat label="国家要素" value={data?.features.length??'加载中'}/><Stat label="当前可见" value={visible.length}/><Stat label="缩放" value={zoom.toFixed(2)}/></Stats>
   {selected?<Status>已定位 {selected.properties.name} · {continentLabel(selected.properties.continent)}</Status>:null}
  </LabLayout>
  <Code text={`const source = map.getSource('countries');\nsource.setData(countries);\nmap.setFilter('countries', ['==', ['get', 'continent'], '${continent}']);\nmap.setPaintProperty('countries', 'fill-color', expression);\nmap.fitBounds(countryBounds, { padding: 28 });`} onCopy={onCopy} label="MapLibre 调用"/>
 </Lab>;
}
