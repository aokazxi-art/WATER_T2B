import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Brush,
} from 'recharts';
import TankGauge   from '../components/TankGauge';
import StatusBadge from '../components/StatusBadge';
import { getStatusColor, getStatus, calcVolumeM3 } from '../utils/waterLevel';
import { loadDailyHistoryAsync } from '../hooks/usePondData';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                   'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const PRESETS = [
  { id:'today', label:'วันนี้' },
  { id:'7d',   label:'7 วัน' },
  { id:'30d',  label:'30 วัน' },
  { id:'custom',label:'กำหนดเอง' },
];
const PAGE_SIZE = 50;

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysAgo(n) { const d=new Date(); d.setDate(d.getDate()-n); return d; }
function getDaysInRange(s,e) {
  const days=[],cur=new Date(s+'T00:00:00'),end=new Date(e+'T00:00:00');
  if(isNaN(cur)||isNaN(end)||cur>end) return days;
  while(cur<=end){days.push(new Date(cur));cur.setDate(cur.getDate()+1);}
  return days;
}
function getDateRange(preset,cS,cE) {
  const t=dateToStr(new Date());
  if(preset==='7d')     return {start:dateToStr(daysAgo(6)),  end:t};
  if(preset==='30d')    return {start:dateToStr(daysAgo(29)), end:t};
  if(preset==='custom') return {start:cS, end:cE};
  return {start:t, end:t};
}
async function loadRange(pondId,s,e) {
  const days=getDaysInRange(s,e);
  if(!days.length) return [];
  const chunks=await Promise.all(days.map(d=>loadDailyHistoryAsync(pondId,d)));
  return chunks.flat().sort((a,b)=>a.time-b.time);
}
function fmtRange(s,e) {
  if(!s||!e) return '';
  const a=new Date(s+'T00:00:00'),b=new Date(e+'T00:00:00');
  const full=d=>`${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
  const short=d=>`${d.getDate()} ${MONTHS_TH[d.getMonth()]}`;
  if(s===e) return full(a);
  return a.getFullYear()===b.getFullYear()?`${short(a)} – ${full(b)}`:`${full(a)} – ${full(b)}`;
}
function fmtTs(ts) {
  const d=new Date(ts);
  const date=`${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
  const time=d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return `${date} ${time}`;
}
function fmtTsShort(ts) {
  const d=new Date(ts);
  return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function buildTicks(data) {
  if(data.length<2) return [];
  const tMin=data[0].time,tMax=data[data.length-1].time;
  const h=(tMax-tMin)/3_600_000;
  const step=h<=4?1:h<=9?2:h<=18?3:h<=36?6:h<=72?12:h<=168?24:Math.ceil(h/8);
  const sm=step*3_600_000,ft=Math.ceil(tMin/sm)*sm,ticks=[];
  for(let t=ft;t<=tMax;t+=sm) ticks.push(t);
  return ticks;
}
function fmtTick(ts,h) {
  const d=new Date(ts);
  if(h<=36)  return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  if(h<=168) return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:00`;
  return `${d.getDate()}/${d.getMonth()+1}`;
}

// ── Stats computation ─────────────────────────────────────────────────────────
function computeStats(enriched, pond) {
  if(!enriched.length) return null;
  const pcts=enriched.map(x=>x.pct);
  const n=pcts.length;
  const avg=pcts.reduce((s,v)=>s+v,0)/n;
  const min=Math.min(...pcts), max=Math.max(...pcts);
  const sd=Math.sqrt(pcts.reduce((s,v)=>s+(v-avg)**2,0)/n);
  const minIdx=pcts.indexOf(min), maxIdx=pcts.indexOf(max);

  let tNormal=0,tWarning=0,tDanger=0;
  for(let i=1;i<enriched.length;i++) {
    const dt=enriched[i].time-enriched[i-1].time;
    if(dt>300_000) continue;
    const mid=(enriched[i].pct+enriched[i-1].pct)/2;
    const st=getStatus(mid,pond.thresholdYellow,pond.thresholdRed);
    if(st==='normal') tNormal+=dt;
    else if(st==='warning') tWarning+=dt;
    else tDanger+=dt;
  }
  const tTot=tNormal+tWarning+tDanger;

  const durationHr=n>=2?(enriched[n-1].time-enriched[0].time)/3_600_000:0;
  const trend=durationHr>0?(enriched[n-1].pct-enriched[0].pct)/durationHr:0;

  let maxRate=0;
  for(let i=1;i<enriched.length;i++) {
    const dt=(enriched[i].time-enriched[i-1].time)/3_600_000;
    if(dt>0&&dt<1) {
      const rate=Math.abs((enriched[i].pct-enriched[i-1].pct)/dt);
      if(rate>maxRate) maxRate=rate;
    }
  }

  return {
    n, avg:avg.toFixed(1), min:min.toFixed(1), max:max.toFixed(1),
    sd:sd.toFixed(1), minTime:enriched[minIdx]?.time, maxTime:enriched[maxIdx]?.time,
    pctNormal: tTot>0?+(tNormal/tTot*100).toFixed(0):null,
    pctWarning:tTot>0?+(tWarning/tTot*100).toFixed(0):null,
    pctDanger: tTot>0?+(tDanger/tTot*100).toFixed(0):null,
    trend:trend.toFixed(2), maxRate:maxRate.toFixed(2),
    firstTime:enriched[0].time, lastTime:enriched[n-1].time,
    durationHr:durationHr.toFixed(1),
  };
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(enriched, pond, start, end) {
  const headers=['ลำดับ','วันที่','เวลา','ระดับ(%)','ความสูง(ซม.)','ปริมาตร(ม³)','แบตเตอรี่(%)','สถานะ','Δ(%/ชม.)'];
  const statusLabel={normal:'ปกติ',warning:'เตือน',danger:'วิกฤต'};
  const rows=enriched.map((d,i)=>{
    const dt=new Date(d.time);
    return [
      i+1,
      `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()+543}`,
      dt.toLocaleTimeString('th-TH'),
      d.pct.toFixed(2), d.wh.toFixed(2), d.volume.toFixed(3),
      d.battery!=null?d.battery:'',
      statusLabel[d.status]??d.status,
      d.deltaRate!=null?d.deltaRate.toFixed(2):'',
    ].join(',');
  });
  const csv='﻿'+[headers.join(','),...rows].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');
  a.href=url; a.download=`${pond.name}_${start}_${end}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function HeroStat({label,value,unit,accent}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em'}}>{label}</div>
      <div style={{display:'flex',alignItems:'baseline',gap:5}}>
        <span style={{fontSize:27,fontWeight:800,lineHeight:1,color:value!=null?(accent||'#0f172a'):'#e2e8f0'}}>
          {value??'—'}
        </span>
        {unit&&value!=null&&<span style={{fontSize:12,color:'#94a3b8',fontWeight:500}}>{unit}</span>}
      </div>
    </div>
  );
}

function StatCard({label,value,accent,sub}) {
  return (
    <div style={{flex:1,minWidth:110,padding:'11px 13px',background:`${accent}09`,borderRadius:12,border:`1px solid ${accent}22`}}>
      <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>{label}</div>
      <div style={{fontSize:20,fontWeight:800,color:accent}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:'#94a3b8',marginTop:3}}>{sub}</div>}
    </div>
  );
}

function StatusBar({label,pct,color}) {
  return (
    <div style={{flex:1,minWidth:120}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>{label}</span>
        <span style={{fontSize:12,fontWeight:800,color}}>{pct!=null?`${pct}%`:'—'}</span>
      </div>
      <div style={{height:7,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct??0}%`,background:color,borderRadius:4,transition:'width .5s ease'}}/>
      </div>
    </div>
  );
}

function StatusChip({status}) {
  const c={normal:'#16a34a',warning:'#d97706',danger:'#dc2626',loading:'#94a3b8'}[status]??'#94a3b8';
  const l={normal:'ปกติ',warning:'เตือน',danger:'วิกฤต',loading:'—'}[status]??status;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 9px',borderRadius:20,background:`${c}14`,color:c,fontSize:11,fontWeight:700}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:c,display:'inline-block'}}/>
      {l}
    </span>
  );
}

function DeltaCell({deltaRate}) {
  if(deltaRate==null) return <span style={{color:'#cbd5e1'}}>—</span>;
  const abs=Math.abs(deltaRate);
  const up=deltaRate>0;
  const c=abs>5?'#dc2626':abs>2?'#d97706':'#16a34a';
  return <span style={{color:c,fontWeight:700,fontSize:12}}>{up?'▲':'▼'} {abs.toFixed(1)}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PondDetailPage({pondId,getPondState,onBack,onOpenSettings,onLogout}) {
  const todayStr=dateToStr(new Date());
  const [preset,   setPreset]   = useState('today');
  const [cStart,   setCStart]   = useState(todayStr);
  const [cEnd,     setCEnd]     = useState(todayStr);
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [page,     setPage]     = useState(0);
  const [showTbl,  setShowTbl]  = useState(false);

  const state=getPondState(pondId);
  const {start,end}=getDateRange(preset,cStart,cEnd);

  useEffect(()=>{
    if(!state?.pond||!start||!end) return;
    let cancelled=false;
    setLoading(true); setPage(0);
    loadRange(state.pond.id,start,end).then(d=>{
      if(!cancelled){setData(d);setLoading(false);}
    });
    return ()=>{cancelled=true;};
  },[state?.pond?.id,start,end]);

  if(!state) return null;
  const {pond,dist,waterHeight,pct,volume,status}=state;
  const color=getStatusColor(status);
  const gradId=`grad-${pond.id}`;

  const enriched=useMemo(()=>data.map((d,i)=>{
    const wh=d.wh??((d.pct/100)*pond.depth);
    const vol=calcVolumeM3(pond.area,wh);
    const st=getStatus(d.pct,pond.thresholdYellow,pond.thresholdRed);
    const prev=data[i-1];
    const delta=prev!=null?d.pct-prev.pct:null;
    const dtHr=prev!=null?(d.time-prev.time)/3_600_000:null;
    const deltaRate=(dtHr!=null&&dtHr>0)?delta/dtHr:null;
    return {...d,wh,volume:vol,status:st,delta,deltaRate};
  }),[data,pond]);

  const stats=useMemo(()=>computeStats(enriched,pond),[enriched,pond]);

  const chartData=enriched.map(x=>({time:x.time,v:x.pct}));
  const rangeHours=chartData.length>=2?(chartData[chartData.length-1].time-chartData[0].time)/3_600_000:24;
  const ticks=buildTicks(chartData);
  const showBrush=rangeHours>12||chartData.length>200;

  const tableRows=useMemo(()=>[...enriched].reverse(),[enriched]);
  const totalPages=Math.ceil(tableRows.length/PAGE_SIZE);
  const pageRows=tableRows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);

  return (
    <div style={{minHeight:'100vh',background:'#f0f4f8'}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}
        .anim1{animation:fadeUp .35s ease both}
        .anim2{animation:fadeUp .35s .1s ease both}
        input[type="date"]::-webkit-calendar-picker-indicator{opacity:.5;cursor:pointer}
        .tbl-row:nth-child(even){background:#f8fafc}
        .tbl-row:hover{background:#eff6ff!important}
        .page-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:13px;font-weight:600;cursor:pointer}
        .page-btn:disabled{opacity:.35;cursor:default}
      `}</style>

      {/* Navbar */}
      <div style={{background:'#fff',borderBottom:'1px solid #e8edf3',padding:'0 24px',height:54,display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:20,boxShadow:'0 1px 8px rgba(0,0,0,.06)'}}>
        <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'#64748b',padding:'4px 2px'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          กลับ
        </button>
        <div style={{width:1,height:20,background:'#e2e8f0'}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:15,fontWeight:700,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pond.name}</span>
            <StatusBadge status={status}/>
          </div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>
            {(pond.area/10000).toFixed(2)} ม²  ·  ลึก {pond.depth} ซม.  ·  offset {pond.sensorOffset} ซม.
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {onOpenSettings&&(
            <button onClick={onOpenSettings} title="Settings" style={sBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
          <button onClick={onLogout} style={{...sBtn,width:'auto',padding:'0 12px',fontSize:12}}>ออก</button>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 20px',display:'flex',flexDirection:'column',gap:16}}>

        {/* Hero card */}
        <div className="anim1" style={{background:'#fff',borderRadius:20,padding:'28px',border:'1px solid #e8edf3',boxShadow:'0 2px 16px rgba(15,30,53,.07)',display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'}}>
          <TankGauge pondWidth={Math.sqrt(pond.area)} pondDepth={pond.depth} fillPercent={pct??0} status={status} id={`large-${pond.id}`} size="large"/>
          <div style={{flex:1,minWidth:180,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'22px 32px'}}>
            <HeroStat label="ระดับน้ำ"     value={pct!=null?pct.toFixed(1):null}                                                                                             unit="%"   accent={color}   />
            <HeroStat label="ความสูงน้ำ"   value={waterHeight!=null?Math.max(0,waterHeight).toFixed(1):null}                                                                 unit="ซม." accent="#0284c7" />
            <HeroStat label="ปริมาณน้ำ"    value={volume!=null?Math.max(0,volume).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):null}            unit="ม³"  accent="#6366f1" />
            <HeroStat label="ระยะเซนเซอร์" value={dist!=null?dist.toFixed(1):null}                                                                                           unit="ซม." accent="#64748b" />
          </div>
        </div>

        {/* Level History card */}
        <div className="anim2" style={{background:'#fff',borderRadius:20,border:'1px solid #e8edf3',boxShadow:'0 2px 16px rgba(15,30,53,.07)',overflow:'hidden'}}>

          {/* ── Header ── */}
          <div style={{padding:'16px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${color}20,${color}08)`,border:`1.5px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>Level History</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{fmtRange(start,end)}</div>
            </div>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <div style={{fontSize:11,fontWeight:600,color:loading?'#0284c7':'#64748b',background:loading?'#e0f2fe':'#f1f5f9',borderRadius:20,padding:'4px 12px'}}>
                {loading?'กำลังโหลด...':`${data.length.toLocaleString()} readings`}
              </div>
              {!loading&&data.length>0&&(
                <button onClick={()=>exportCSV(enriched,pond,start,end)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',background:'#f0fdf4',border:'1.5px solid #86efac',color:'#16a34a'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div style={{padding:'12px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            {PRESETS.map(p=>{
              const active=preset===p.id;
              return (
                <button key={p.id} onClick={()=>{setPreset(p.id);setPage(0);}} style={{padding:'6px 16px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .18s',border:active?'none':'1.5px solid #e2e8f0',background:active?color:'#f8fafc',color:active?'#fff':'#64748b',boxShadow:active?`0 2px 10px ${color}40`:'none'}}>
                  {p.label}
                </button>
              );
            })}
            {preset==='custom'&&(
              <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:4,flexWrap:'wrap'}}>
                <div style={{width:1,height:18,background:'#e2e8f0'}}/>
                <input type="date" value={cStart} max={cEnd||todayStr} onChange={e=>{setCStart(e.target.value);setPage(0);}} style={dInput}/>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <input type="date" value={cEnd} min={cStart} max={todayStr} onChange={e=>{setCEnd(e.target.value);setPage(0);}} style={dInput}/>
              </div>
            )}
          </div>

          {/* ── Stats panel ── */}
          {stats&&!loading&&(
            <div style={{padding:'16px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',flexDirection:'column',gap:14}}>

              {/* Metric cards */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <StatCard label="เฉลี่ย"         value={`${stats.avg}%`}  accent={color}    />
                <StatCard label="ต่ำสุด"          value={`${stats.min}%`}  accent="#16a34a"  sub={stats.minTime?`เวลา ${fmtTsShort(stats.minTime)}`:null}/>
                <StatCard label="สูงสุด"          value={`${stats.max}%`}  accent="#dc2626"  sub={stats.maxTime?`เวลา ${fmtTsShort(stats.maxTime)}`:null}/>
                <StatCard label="ค่าเบี่ยงเบน SD" value={`${stats.sd}%`}   accent="#6366f1"  />
                <StatCard label="แนวโน้มรวม"      value={`${parseFloat(stats.trend)>=0?'+':''}${stats.trend}%`} accent={parseFloat(stats.trend)>0?'#0284c7':parseFloat(stats.trend)<0?'#dc2626':'#64748b'} sub="ต่อชั่วโมง"/>
                <StatCard label="อัตราสูงสุด"     value={`±${stats.maxRate}%`} accent="#d97706" sub="ต่อชั่วโมง"/>
              </div>

              {/* Time-in-status */}
              {stats.pctNormal!=null&&(
                <div>
                  <div style={{fontSize:10,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>เวลาในแต่ละสถานะ</div>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                    <StatusBar label="ปกติ"  pct={stats.pctNormal}  color="#16a34a"/>
                    <StatusBar label="เตือน" pct={stats.pctWarning} color="#d97706"/>
                    <StatusBar label="วิกฤต" pct={stats.pctDanger}  color="#dc2626"/>
                  </div>
                </div>
              )}

              {/* Period info */}
              <div style={{display:'flex',gap:20,flexWrap:'wrap',borderTop:'1px dashed #f1f5f9',paddingTop:10}}>
                {[
                  ['เริ่ม',fmtTs(stats.firstTime)],
                  ['สิ้นสุด',fmtTs(stats.lastTime)],
                  ['ระยะเวลา',`${stats.durationHr} ชั่วโมง`],
                  ['จำนวน',`${stats.n.toLocaleString()} readings`],
                ].map(([k,v])=>(
                  <div key={k} style={{fontSize:11,color:'#94a3b8'}}>
                    <span style={{fontWeight:700,color:'#64748b'}}>{k}: </span>{v}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Chart ── */}
          <div style={{padding:'16px 8px 8px'}}>
            {loading?(
              <div style={{height:200,borderRadius:12,background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {[0,.15,.3].map(d=>(
                    <div key={d} style={{width:8,height:8,borderRadius:'50%',background:color,animation:`blink 1.2s ${d}s ease-in-out infinite`}}/>
                  ))}
                </div>
              </div>
            ):chartData.length>=2?(
              <ResponsiveContainer width="100%" height={showBrush?240:200}>
                <AreaChart data={chartData} margin={{top:12,right:16,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity={0.18}/>
                      <stop offset="100%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="time" type="number" scale="time" domain={['dataMin','dataMax']} ticks={ticks} tickFormatter={ts=>fmtTick(ts,rangeHours)} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} minTickGap={36}/>
                  <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94a3b8'}} tickFormatter={v=>`${v}%`} width={36} axisLine={false} tickLine={false}/>
                  <ReferenceLine y={pond.thresholdYellow} stroke="#d97706" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{value:`เตือน ${pond.thresholdYellow}%`,position:'insideTopLeft',fontSize:10,fill:'#d97706',fontWeight:700}}/>
                  <ReferenceLine y={pond.thresholdRed} stroke="#dc2626" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{value:`วิกฤต ${pond.thresholdRed}%`,position:'insideTopLeft',fontSize:10,fill:'#dc2626',fontWeight:700}}/>
                  <Tooltip
                    content={({active,payload})=>{
                      if(!active||!payload?.length) return null;
                      const d=payload[0].payload;
                      const rp=enriched.find(x=>x.time===d.time);
                      return (
                        <div style={{background:'#fff',border:'1px solid #e2e8f0',padding:'10px 14px',borderRadius:12,fontSize:12,boxShadow:'0 4px 16px rgba(0,0,0,.1)',minWidth:170}}>
                          <div style={{fontWeight:800,color,fontSize:18,marginBottom:4}}>{d.v?.toFixed(1)}%</div>
                          {rp&&<>
                            <div style={{color:'#475569',marginBottom:2}}>ความสูง: <b>{rp.wh.toFixed(1)} ซม.</b></div>
                            <div style={{color:'#475569',marginBottom:4}}>ปริมาตร: <b>{rp.volume.toFixed(3)} ม³</b></div>
                            {rp.deltaRate!=null&&<div style={{marginBottom:4,fontSize:11,color:Math.abs(rp.deltaRate)>5?'#dc2626':Math.abs(rp.deltaRate)>2?'#d97706':'#16a34a',fontWeight:700}}>Δ {rp.deltaRate>0?'+':''}{rp.deltaRate.toFixed(1)}%/ชม.</div>}
                            <StatusChip status={rp.status}/>
                          </>}
                          <div style={{color:'#94a3b8',marginTop:6,fontSize:11}}>{fmtTs(d.time)}</div>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} isAnimationActive={false}/>
                  {showBrush&&<Brush dataKey="time" height={22} stroke="#e2e8f0" fill="#f8fafc" travellerWidth={6} tickFormatter={ts=>fmtTick(ts,rangeHours)}/>}
                </AreaChart>
              </ResponsiveContainer>
            ):(
              <div style={{height:130,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,background:'#f8fafc',borderRadius:12}}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{fontSize:13,color:'#94a3b8',fontWeight:500}}>ไม่มีข้อมูลสำหรับช่วงวันที่เลือก</span>
              </div>
            )}
          </div>

          {/* ── Data table toggle ── */}
          {!loading&&data.length>0&&(
            <div style={{borderTop:'1px solid #f1f5f9'}}>
              <button onClick={()=>setShowTbl(v=>!v)} style={{width:'100%',padding:'12px 20px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700,color:'#475569'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                {showTbl?'ซ่อนตารางข้อมูล':`แสดงตารางข้อมูล (${data.length.toLocaleString()} รายการ)`}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{marginLeft:'auto',transform:showTbl?'rotate(180deg)':'none',transition:'transform .2s'}}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showTbl&&(
                <div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead>
                        <tr style={{background:'#f8fafc',borderTop:'1px solid #f1f5f9',borderBottom:'2px solid #e2e8f0'}}>
                          {['#','วันเวลา','ระดับ (%)','ความสูง (ซม.)','ปริมาตร (ม³)','สถานะ','แบต','Δ %/ชม.'].map((h,i)=>(
                            <th key={i} style={{padding:'10px 14px',textAlign:i===0?'center':'left',fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row,i)=>{
                          const rowNum=tableRows.length-(page*PAGE_SIZE+i);
                          const sc=getStatusColor(row.status);
                          return (
                            <tr key={row.time} className="tbl-row" style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:'8px 14px',textAlign:'center',color:'#94a3b8',fontWeight:600,fontSize:11}}>{rowNum}</td>
                              <td style={{padding:'8px 14px',color:'#374151',whiteSpace:'nowrap',fontFamily:'monospace',fontSize:11}}>{fmtTs(row.time)}</td>
                              <td style={{padding:'8px 14px',fontWeight:800,color:sc,fontSize:14}}>{row.pct.toFixed(2)}%</td>
                              <td style={{padding:'8px 14px',color:'#374151',fontWeight:600}}>{row.wh.toFixed(1)}</td>
                              <td style={{padding:'8px 14px',color:'#374151',fontWeight:600}}>{row.volume.toFixed(3)}</td>
                              <td style={{padding:'8px 14px'}}><StatusChip status={row.status}/></td>
                              <td style={{padding:'8px 14px',color:'#374151'}}>{row.battery!=null?`${row.battery}%`:<span style={{color:'#cbd5e1'}}>—</span>}</td>
                              <td style={{padding:'8px 14px'}}><DeltaCell deltaRate={row.deltaRate}/></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages>1&&(
                    <div style={{padding:'12px 20px',borderTop:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                      <div style={{fontSize:12,color:'#64748b'}}>
                        แสดง {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,tableRows.length)} จาก {tableRows.length.toLocaleString()} รายการ
                      </div>
                      <div style={{display:'flex',gap:4,alignItems:'center'}}>
                        <button className="page-btn" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>‹</button>
                        {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
                          let pg;
                          if(totalPages<=7) pg=i;
                          else if(page<=3) pg=i;
                          else if(page>=totalPages-4) pg=totalPages-7+i;
                          else pg=page-3+i;
                          return (
                            <button key={pg} className="page-btn" onClick={()=>setPage(pg)} style={{background:pg===page?color:'#f8fafc',color:pg===page?'#fff':'#64748b',fontWeight:pg===page?800:500,border:`1px solid ${pg===page?color:'#e2e8f0'}`}}>
                              {pg+1}
                            </button>
                          );
                        })}
                        <button className="page-btn" disabled={page===totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>›</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sBtn={display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,width:32,height:32,cursor:'pointer',color:'#64748b',padding:0};
const dInput={padding:'5px 10px',borderRadius:8,fontSize:12,border:'1.5px solid #e2e8f0',color:'#374151',background:'#f8fafc',outline:'none',cursor:'pointer'};
