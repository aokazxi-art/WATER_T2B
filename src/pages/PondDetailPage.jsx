import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Brush,
} from 'recharts';
import TankGauge   from '../components/TankGauge';
import StatusBadge from '../components/StatusBadge';
import { getStatusColor, getStatus, calcVolumeM3 } from '../utils/waterLevel';
import { loadDailyHistoryAsync, subscribeDailyHistory } from '../hooks/usePondData';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                   'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const PRESETS = [
  { id:'today',  label:'วันนี้' },
  { id:'7d',     label:'7 วัน' },
  { id:'30d',    label:'30 วัน' },
  { id:'custom', label:'กำหนดเอง' },
];
const PAGE_SIZE = 50;
const STATUS_TH = { normal:'ปกติ', warning:'เตือน', danger:'วิกฤต', loading:'—' };

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return d; }
function getDaysInRange(s, e) {
  const days=[], cur=new Date(s+'T00:00:00'), end=new Date(e+'T00:00:00');
  if (isNaN(cur)||isNaN(end)||cur>end) return days;
  while (cur<=end) { days.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
  return days;
}
function getDateRange(preset, cS, cE) {
  const t = dateToStr(new Date());
  if (preset==='7d')     return { start: dateToStr(daysAgo(6)),  end: t };
  if (preset==='30d')    return { start: dateToStr(daysAgo(29)), end: t };
  if (preset==='custom') return { start: cS, end: cE };
  return { start: t, end: t };
}
async function loadRange(pondId, s, e) {
  const days = getDaysInRange(s, e);
  if (!days.length) return [];
  const chunks = await Promise.all(days.map(d => loadDailyHistoryAsync(pondId, d)));
  return chunks.flat().sort((a, b) => a.time - b.time);
}
function fmtRange(s, e) {
  if (!s||!e) return '';
  const a = new Date(s+'T00:00:00'), b = new Date(e+'T00:00:00');
  const full  = d => `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
  const short = d => `${d.getDate()} ${MONTHS_TH[d.getMonth()]}`;
  if (s===e) return full(a);
  return a.getFullYear()===b.getFullYear() ? `${short(a)} – ${full(b)}` : `${full(a)} – ${full(b)}`;
}
function fmtTs(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543} `
       + d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function fmtTsShort(ts) {
  return new Date(ts).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
}
function fmtHour(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:00`;
}
function fmtDay(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
}
function fmtDuration(ms) {
  if (ms < 60_000) return `${Math.round(ms/1000)} วิ`;
  if (ms < 3_600_000) return `${Math.round(ms/60_000)} นาที`;
  const h = (ms/3_600_000).toFixed(1);
  return `${h} ชม.`;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function buildTicks(data) {
  if (data.length < 2) return [];
  const tMin = data[0].time, tMax = data[data.length-1].time;
  const h = (tMax-tMin)/3_600_000;
  const step = h<=4?1 : h<=9?2 : h<=18?3 : h<=36?6 : h<=72?12 : h<=168?24 : Math.ceil(h/8);
  const sm = step*3_600_000, ft = Math.ceil(tMin/sm)*sm, ticks = [];
  for (let t=ft; t<=tMax; t+=sm) ticks.push(t);
  return ticks;
}
function fmtTick(ts, h) {
  const d = new Date(ts);
  if (h<=36)  return d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  if (h<=168) return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:00`;
  return `${d.getDate()}/${d.getMonth()+1}`;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function computeStats(enriched, pond) {
  if (!enriched.length) return null;
  const pcts = enriched.map(x => x.pct);
  const n = pcts.length;
  const avg = pcts.reduce((s,v) => s+v, 0) / n;
  let min = Infinity, max = -Infinity, minIdx = -1, maxIdx = -1;
  for (let i = 0; i < pcts.length; i++) {
    const v = pcts[i];
    if (v < min) { min = v; minIdx = i; }
    if (v > max) { max = v; maxIdx = i; }
  }
  const sd  = Math.sqrt(pcts.reduce((s,v) => s+(v-avg)**2, 0) / n);

  // Time-in-status (trapezoid)
  let tN=0, tW=0, tD=0;
  for (let i=1; i<enriched.length; i++) {
    const dt = enriched[i].time - enriched[i-1].time;
    if (dt > 600_000) continue; // skip gaps > 10 min
    const mid = (enriched[i].pct + enriched[i-1].pct) / 2;
    const st = getStatus(mid, pond.thresholdYellow, pond.thresholdRed);
    if (st==='normal') tN+=dt; else if (st==='warning') tW+=dt; else tD+=dt;
  }
  const tTot = tN + tW + tD;

  // Overall trend
  const durationHr = n>=2 ? (enriched[n-1].time - enriched[0].time) / 3_600_000 : 0;
  const trend = durationHr>0 ? (enriched[n-1].pct - enriched[0].pct) / durationHr : 0;

  // Max rate of change
  let maxRate = 0;
  for (let i=1; i<enriched.length; i++) {
    const dt = (enriched[i].time - enriched[i-1].time) / 3_600_000;
    if (dt>0 && dt<1) {
      const r = Math.abs((enriched[i].pct - enriched[i-1].pct) / dt);
      if (r > maxRate) maxRate = r;
    }
  }

  // Data quality
  const intervals = [];
  for (let i=1; i<enriched.length; i++) intervals.push(enriched[i].time - enriched[i-1].time);
  const avgIntervalMs = intervals.length ? intervals.reduce((s,v)=>s+v,0)/intervals.length : 0;
  const gapThreshold  = Math.max(avgIntervalMs*4, 120_000); // 4x avg or 2 min
  let gapCount = 0, longestGap = 0;
  for (const dt of intervals) {
    if (dt > gapThreshold) { gapCount++; if (dt > longestGap) longestGap = dt; }
  }
  const expectedN  = avgIntervalMs>0 ? Math.round((enriched[n-1].time-enriched[0].time) / avgIntervalMs) : n;
  const coverage   = expectedN>0 ? Math.min(100, Math.round(n/expectedN*100)) : 100;

  return {
    n, avg: avg.toFixed(1), min: min.toFixed(1), max: max.toFixed(1), sd: sd.toFixed(1),
    minTime: enriched[minIdx]?.time, maxTime: enriched[maxIdx]?.time,
    pctN: tTot>0 ? +(tN/tTot*100).toFixed(0) : null,
    pctW: tTot>0 ? +(tW/tTot*100).toFixed(0) : null,
    pctD: tTot>0 ? +(tD/tTot*100).toFixed(0) : null,
    trend: trend.toFixed(2), maxRate: maxRate.toFixed(2),
    firstTime: enriched[0].time, lastTime: enriched[n-1].time,
    durationHr: durationHr.toFixed(1),
    avgIntervalSec: Math.round(avgIntervalMs/1000),
    gapCount, longestGapMs: longestGap, coverage,
  };
}

function buildAlertEvents(enriched, pond) {
  const events = [];
  let prev = null;
  for (const d of enriched) {
    if (prev !== null && d.status !== prev) {
      events.push({ time: d.time, from: prev, to: d.status, pct: d.pct });
    }
    prev = d.status;
  }
  return events.reverse();
}

function buildHourlyAgg(enriched, pond) {
  const map = new Map();
  for (const d of enriched) {
    const dt = new Date(d.time);
    const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours()).getTime();
    if (!map.has(key)) map.set(key, { ts: key, pcts: [], first: d.pct });
    const b = map.get(key); b.pcts.push(d.pct); b.last = d.pct;
  }
  return [...map.values()].sort((a,b)=>b.ts-a.ts).map(b => {
    const avg = b.pcts.reduce((s,v)=>s+v,0)/b.pcts.length;
    let mn = Infinity, mx = -Infinity;
    for (const v of b.pcts) { if (v < mn) mn = v; if (v > mx) mx = v; }
    return {
      ts: b.ts,
      avg: +avg.toFixed(1),
      min: +mn.toFixed(1),
      max: +mx.toFixed(1),
      count: b.pcts.length,
      trend: +(b.last - b.first).toFixed(1),
      status: getStatus(avg, pond.thresholdYellow, pond.thresholdRed),
    };
  });
}

function buildDailyAgg(enriched, pond) {
  const map = new Map();
  for (const d of enriched) {
    const dt = new Date(d.time);
    const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    if (!map.has(key)) map.set(key, { ts: key, pcts: [], first: d.pct });
    const b = map.get(key); b.pcts.push(d.pct); b.last = d.pct;
  }
  return [...map.values()].sort((a,b)=>b.ts-a.ts).map(b => {
    const avg = b.pcts.reduce((s,v)=>s+v,0)/b.pcts.length;
    let mn = Infinity, mx = -Infinity;
    for (const v of b.pcts) { if (v < mn) mn = v; if (v > mx) mx = v; }
    return {
      ts: b.ts,
      avg: +avg.toFixed(1),
      min: +mn.toFixed(1),
      max: +mx.toFixed(1),
      count: b.pcts.length,
      trend: +(b.last - b.first).toFixed(1),
      status: getStatus(avg, pond.thresholdYellow, pond.thresholdRed),
    };
  });
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(enriched, pond, start, end) {
  const headers = ['ลำดับ','วันที่','เวลา','ระดับ(%)','ความสูง(ซม.)','ปริมาตร(ม³)','แบตเตอรี่(%)','สถานะ','Δ(%/ชม.)'];
  const rows = enriched.map((d, i) => {
    const dt = new Date(d.time);
    return [
      i+1,
      `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()+543}`,
      dt.toLocaleTimeString('th-TH'),
      d.pct.toFixed(2), d.wh.toFixed(2), d.volume.toFixed(3),
      d.battery != null ? d.battery : '',
      STATUS_TH[d.status] ?? d.status,
      d.deltaRate != null ? d.deltaRate.toFixed(2) : '',
    ].join(',');
  });
  const csv = '﻿' + [headers.join(','), ...rows].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${pond.name}_${start}_${end}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Small UI components ───────────────────────────────────────────────────────
function HeroStat({ label, value, unit, accent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700,
        textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
        <span style={{ fontSize:27, fontWeight:800, lineHeight:1,
          color: value!=null ? (accent||'#0f172a') : '#e2e8f0' }}>{value??'—'}</span>
        {unit && value!=null && <span style={{ fontSize:12, color:'#94a3b8', fontWeight:500 }}>{unit}</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }) {
  return (
    <div style={{ flex:1, minWidth:100, padding:'10px 12px',
      background:`${accent}09`, borderRadius:12, border:`1px solid ${accent}20` }}>
      <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700,
        textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:800, color:accent, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:'#94a3b8', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function StatusBar({ label, pct, color }) {
  return (
    <div style={{ flex:1, minWidth:100 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:800, color }}>{pct!=null ? `${pct}%` : '—'}</span>
      </div>
      <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct??0}%`, background:color,
          borderRadius:4, transition:'width .5s ease' }}/>
      </div>
    </div>
  );
}

function StatusChip({ status, small }) {
  const c = { normal:'#16a34a', warning:'#d97706', danger:'#dc2626', loading:'#94a3b8' }[status] ?? '#94a3b8';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3,
      padding: small ? '1px 7px' : '2px 9px',
      borderRadius:20, background:`${c}14`, color:c,
      fontSize: small ? 10 : 11, fontWeight:700 }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:c, display:'inline-block' }}/>
      {STATUS_TH[status] ?? status}
    </span>
  );
}

function DeltaCell({ deltaRate, small }) {
  if (deltaRate == null) return <span style={{ color:'#cbd5e1' }}>—</span>;
  const abs = Math.abs(deltaRate);
  const c = abs>5 ? '#dc2626' : abs>2 ? '#d97706' : '#16a34a';
  return (
    <span style={{ color:c, fontWeight:700, fontSize: small ? 11 : 12 }}>
      {deltaRate>0 ? '▲' : '▼'} {abs.toFixed(1)}
    </span>
  );
}

function RangeBar({ min, max, value, low, high }) {
  const toX = v => ((v-0)/(100-0)*100);
  const warnX  = toX(low);
  const dangerX = toX(high);
  const minX = toX(min), maxX = toX(max);
  const valX = toX(value);
  return (
    <div style={{ position:'relative', height:8, background:'#f1f5f9', borderRadius:4, minWidth:60, width:'100%' }}>
      {/* danger zone */}
      <div style={{ position:'absolute', left:`${dangerX}%`, right:0, top:0, bottom:0, background:'#fef2f2', borderRadius:'0 4px 4px 0' }}/>
      {/* warning zone */}
      <div style={{ position:'absolute', left:`${warnX}%`, width:`${dangerX-warnX}%`, top:0, bottom:0, background:'#fffbeb' }}/>
      {/* range bar */}
      <div style={{ position:'absolute', left:`${minX}%`, width:`${maxX-minX}%`, top:2, bottom:2,
        background:'#0284c7', borderRadius:2, opacity:.4 }}/>
      {/* avg dot */}
      <div style={{ position:'absolute', left:`${valX}%`, top:'50%', transform:'translate(-50%,-50%)',
        width:10, height:10, borderRadius:'50%', background:'#0284c7',
        border:'2px solid #fff', boxShadow:'0 0 0 1px #0284c7' }}/>
    </div>
  );
}

function AlertEventRow({ ev }) {
  const fromC = getStatusColor(ev.from), toC = getStatusColor(ev.to);
  const toLabel = STATUS_TH[ev.to];
  const icon = ev.to==='danger' ? '🔴' : ev.to==='warning' ? '🟡' : '🟢';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10,
      padding:'8px 14px', borderBottom:'1px solid #f8fafc' }}>
      <span style={{ fontSize:14 }}>{icon}</span>
      <div style={{ fontSize:11, fontFamily:'monospace', color:'#64748b', whiteSpace:'nowrap' }}>
        {fmtTs(ev.time)}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
        <StatusChip status={ev.from} small/>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        <StatusChip status={ev.to} small/>
      </div>
      <div style={{ fontSize:11, fontWeight:700, color: toC }}>{ev.pct.toFixed(1)}%</div>
    </div>
  );
}

function ViewTab({ id, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      padding:'7px 16px', border:'none', cursor:'pointer',
      background: active ? '#fff' : 'transparent',
      color: active ? '#0f172a' : '#64748b',
      fontWeight: active ? 700 : 500, fontSize:12,
      borderBottom: active ? '2px solid #0284c7' : '2px solid transparent',
      transition:'all .15s',
    }}>{label}</button>
  );
}

function Pagination({ page, totalPages, onPage, color }) {
  if (totalPages <= 1) return null;
  const pages = [];
  if (totalPages <= 7) { for (let i=0; i<totalPages; i++) pages.push(i); }
  else if (page <= 3) { for (let i=0; i<7; i++) pages.push(i); }
  else if (page >= totalPages-4) { for (let i=totalPages-7; i<totalPages; i++) pages.push(i); }
  else { for (let i=page-3; i<=page+3; i++) pages.push(i); }
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <button className="pgb" disabled={page===0} onClick={()=>onPage(Math.max(0,page-1))}>‹</button>
      {pages.map(pg => (
        <button key={pg} className="pgb" onClick={()=>onPage(pg)}
          style={{ background:pg===page?color:'#f8fafc', color:pg===page?'#fff':'#64748b',
            fontWeight:pg===page?800:500, border:`1px solid ${pg===page?color:'#e2e8f0'}` }}>
          {pg+1}
        </button>
      ))}
      <button className="pgb" disabled={page===totalPages-1} onClick={()=>onPage(Math.min(totalPages-1,page+1))}>›</button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PondDetailPage({ pondId, getPondState, onBack, onOpenSettings, onLogout }) {
  const todayStr = dateToStr(new Date());
  const [preset,  setPreset]  = useState('today');
  const [cStart,  setCStart]  = useState(todayStr);
  const [cEnd,    setCEnd]    = useState(todayStr);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState('chart');   // chart | hourly | daily | raw
  const [page,    setPage]    = useState(0);
  const [stFilter, setStFilter] = useState('all');   // all | normal | warning | danger
  const [showAlerts, setShowAlerts] = useState(true);

  const state = getPondState(pondId);
  const { start, end } = getDateRange(preset, cStart, cEnd);

  useEffect(() => {
    if (!state?.pond || !start || !end) return;
    let cancelled = false;
    setLoading(true); setPage(0);

    const pondId        = state.pond.id;
    const today         = new Date();
    const todayStr      = dateToStr(today);
    const includesToday = end >= todayStr;
    const pastEnd       = includesToday ? dateToStr(daysAgo(1)) : end;
    const hasPast       = start <= pastEnd;

    let pastData   = [];
    let todayData  = [];
    let pastReady  = !hasPast;
    let todayReady = !includesToday;

    const merge = () => {
      if (cancelled || !pastReady || !todayReady) return;
      setData([...pastData, ...todayData].sort((a, b) => a.time - b.time));
      setLoading(false);
    };

    if (hasPast) {
      loadRange(pondId, start, pastEnd).then(d => {
        if (cancelled) return;
        pastData  = d;
        pastReady = true;
        merge();
      });
    }

    let unsubToday = () => {};
    if (includesToday) {
      unsubToday = subscribeDailyHistory(pondId, today, arr => {
        if (cancelled) return;
        todayData  = arr;
        todayReady = true;
        merge();
      });
    }

    return () => { cancelled = true; unsubToday(); };
  }, [state?.pond?.id, start, end]);

  if (!state) return null;
  const { pond, dist, waterHeight, pct, volume, status } = state;
  const color  = getStatusColor(status);
  const gradId = `grad-${pond.id}`;

  // Enriched data
  const enriched = useMemo(() => data.map((d, i) => {
    const wh  = d.wh ?? ((d.pct/100) * pond.depth);
    const vol = calcVolumeM3(pond.area, wh);
    const st  = getStatus(d.pct, pond.thresholdYellow, pond.thresholdRed);
    const prev = data[i-1];
    const delta = prev != null ? d.pct - prev.pct : null;
    const dtHr  = prev != null ? (d.time - prev.time) / 3_600_000 : null;
    const deltaRate = (dtHr != null && dtHr > 0) ? delta / dtHr : null;
    return { ...d, wh, volume: vol, status: st, delta, deltaRate };
  }), [data, pond]);

  const stats       = useMemo(() => computeStats(enriched, pond),        [enriched, pond]);
  const alertEvents = useMemo(() => buildAlertEvents(enriched, pond),    [enriched, pond]);
  const hourlyAgg   = useMemo(() => buildHourlyAgg(enriched, pond),      [enriched, pond]);
  const dailyAgg    = useMemo(() => buildDailyAgg(enriched, pond),       [enriched, pond]);

  // Chart data
  const chartData  = enriched.map(x => ({ time: x.time, v: x.pct }));
  const rangeHours = chartData.length >= 2
    ? (chartData[chartData.length-1].time - chartData[0].time) / 3_600_000 : 24;
  const ticks = buildTicks(chartData);
  const showBrush = rangeHours > 12 || chartData.length > 200;
  const showDailyTab = rangeHours > 23;

  // Table (raw)
  const tableRows = useMemo(() => {
    const reversed = [...enriched].reverse();
    if (stFilter === 'all') return reversed;
    return reversed.filter(r => r.status === stFilter);
  }, [enriched, stFilter]);
  const totalPages = Math.ceil(tableRows.length / PAGE_SIZE);
  const pageRows   = tableRows.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
  const minPct = stats ? parseFloat(stats.min) : null;
  const maxPct = stats ? parseFloat(stats.max) : null;

  const tabs = [
    { id:'chart',  label:'กราฟ' },
    { id:'hourly', label:'รายชั่วโมง' },
    ...(showDailyTab ? [{ id:'daily', label:'รายวัน' }] : []),
    { id:'raw',    label:'ตารางข้อมูล' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f8' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}
        .anim1{animation:fadeUp .3s ease both}
        .anim2{animation:fadeUp .3s .08s ease both}
        input[type="date"]::-webkit-calendar-picker-indicator{opacity:.5;cursor:pointer}
        .tbl-row:nth-child(even){background:#fafbfc}
        .tbl-row:hover{background:#eff6ff!important}
        .pgb{display:flex;align-items:center;justify-content:center;width:30px;height:30px;
             border-radius:7px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;
             font-size:13px;font-weight:600;cursor:pointer}
        .pgb:disabled{opacity:.35;cursor:default}
        .stf-btn{padding:4px 12px;border-radius:16px;border:1.5px solid #e2e8f0;
                  background:#f8fafc;color:#64748b;font-size:11px;font-weight:700;cursor:pointer}
      `}</style>

      {/* ── Navbar ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e8edf3', padding:'0 24px',
        height:54, display:'flex', alignItems:'center', gap:12,
        position:'sticky', top:0, zIndex:20, boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:5,
          background:'none', border:'none', cursor:'pointer',
          fontSize:13, fontWeight:600, color:'#64748b', padding:'4px 2px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          กลับ
        </button>
        <div style={{ width:1, height:20, background:'#e2e8f0' }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#0f172a',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pond.name}</span>
            <StatusBadge status={status}/>
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>
            {(pond.area/10000).toFixed(2)} ม²  ·  ลึก {pond.depth} ซม.  ·  offset {pond.sensorOffset} ซม.
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {onOpenSettings && (
            <button onClick={onOpenSettings} style={S.iconBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
          <button onClick={onLogout} style={{ ...S.iconBtn, width:'auto', padding:'0 12px', fontSize:12 }}>ออก</button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px',
        display:'flex', flexDirection:'column', gap:16 }}>

        {/* Hero card */}
        <div className="anim1" style={{ background:'#fff', borderRadius:20, padding:'28px',
          border:'1px solid #e8edf3', boxShadow:'0 2px 16px rgba(15,30,53,.07)',
          display:'flex', gap:24, flexWrap:'wrap', alignItems:'center' }}>
          <TankGauge pondWidth={Math.sqrt(pond.area)} pondDepth={pond.depth}
            fillPercent={pct??0} status={status} id={`large-${pond.id}`} size="large"/>
          <div style={{ flex:1, minWidth:180, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'22px 32px' }}>
            <HeroStat label="ระดับน้ำ"     value={pct!=null ? pct.toFixed(1) : null}                                                                                             unit="%"   accent={color}   />
            <HeroStat label="ความสูงน้ำ"   value={waterHeight!=null ? Math.max(0,waterHeight).toFixed(1) : null}                                                                 unit="ซม." accent="#0284c7" />
            <HeroStat label="ปริมาณน้ำ"    value={volume!=null ? Math.max(0,volume).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : null}            unit="ม³"  accent="#6366f1" />
            <HeroStat label="ระยะเซนเซอร์" value={dist!=null ? dist.toFixed(1) : null}                                                                                           unit="ซม." accent="#64748b" />
          </div>
        </div>

        {/* ── Level History card ── */}
        <div className="anim2" style={{ background:'#fff', borderRadius:20,
          border:'1px solid #e8edf3', boxShadow:'0 2px 16px rgba(15,30,53,.07)', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9',
            display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ width:32, height:32, borderRadius:9, flexShrink:0,
              background:`linear-gradient(135deg,${color}20,${color}08)`,
              border:`1.5px solid ${color}30`,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Level History</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{fmtRange(start, end)}</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div style={{ fontSize:11, fontWeight:600, borderRadius:20, padding:'4px 12px',
                color: loading ? '#0284c7' : '#64748b',
                background: loading ? '#e0f2fe' : '#f1f5f9' }}>
                {loading ? 'กำลังโหลด...' : `${data.length.toLocaleString()} readings`}
              </div>
              {!loading && data.length > 0 && (
                <button onClick={() => exportCSV(enriched, pond, start, end)}
                  style={{ display:'flex', alignItems:'center', gap:6,
                    padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700,
                    cursor:'pointer', background:'#f0fdf4', border:'1.5px solid #86efac', color:'#16a34a' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ padding:'10px 20px', borderBottom:'1px solid #f1f5f9',
            display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
            {PRESETS.map(p => {
              const active = preset === p.id;
              return (
                <button key={p.id} onClick={() => { setPreset(p.id); setPage(0); }} style={{
                  padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700,
                  cursor:'pointer', transition:'all .15s',
                  border: active ? 'none' : '1.5px solid #e2e8f0',
                  background: active ? color : '#f8fafc',
                  color: active ? '#fff' : '#64748b',
                  boxShadow: active ? `0 2px 10px ${color}40` : 'none',
                }}>{p.label}</button>
              );
            })}
            {preset === 'custom' && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:4, flexWrap:'wrap' }}>
                <div style={{ width:1, height:18, background:'#e2e8f0' }}/>
                <input type="date" value={cStart} max={cEnd||todayStr}
                  onChange={e => { setCStart(e.target.value); setPage(0); }} style={S.dateInput}/>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
                <input type="date" value={cEnd} min={cStart} max={todayStr}
                  onChange={e => { setCEnd(e.target.value); setPage(0); }} style={S.dateInput}/>
              </div>
            )}
          </div>

          {/* ── Stats Panel ── */}
          {stats && !loading && (
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9',
              display:'flex', flexDirection:'column', gap:12 }}>

              {/* KPI cards row 1 */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <KpiCard label="เฉลี่ย"          value={`${stats.avg}%`}  accent={color}    />
                <KpiCard label="ต่ำสุด"           value={`${stats.min}%`}  accent="#16a34a"
                  sub={stats.minTime ? `เวลา ${fmtTsShort(stats.minTime)}` : null}/>
                <KpiCard label="สูงสุด"           value={`${stats.max}%`}  accent="#dc2626"
                  sub={stats.maxTime ? `เวลา ${fmtTsShort(stats.maxTime)}` : null}/>
                <KpiCard label="SD"               value={`${stats.sd}%`}   accent="#6366f1"  />
                <KpiCard label="แนวโน้ม"          value={`${parseFloat(stats.trend)>=0?'+':''}${stats.trend}%`}
                  accent={parseFloat(stats.trend)>0?'#0284c7':parseFloat(stats.trend)<0?'#dc2626':'#64748b'}
                  sub="ต่อชั่วโมง"/>
                <KpiCard label="อัตราเปลี่ยนสูงสุด" value={`±${stats.maxRate}%`} accent="#d97706" sub="ต่อชั่วโมง"/>
              </div>

              {/* Time-in-status */}
              {stats.pctN != null && (
                <div>
                  <div style={{ fontSize:9, color:'#64748b', fontWeight:700,
                    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>
                    เวลาในแต่ละสถานะ
                  </div>
                  <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                    <StatusBar label="ปกติ"  pct={stats.pctN} color="#16a34a"/>
                    <StatusBar label="เตือน" pct={stats.pctW} color="#d97706"/>
                    <StatusBar label="วิกฤต" pct={stats.pctD} color="#dc2626"/>
                  </div>
                </div>
              )}

              {/* Data quality + period */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap',
                borderTop:'1px dashed #f1f5f9', paddingTop:10 }}>
                {[
                  ['เริ่ม',      fmtTs(stats.firstTime)],
                  ['สิ้นสุด',   fmtTs(stats.lastTime)],
                  ['ระยะเวลา',  `${stats.durationHr} ชม.`],
                  ['ช่วงอ่านค่า', stats.avgIntervalSec >= 60
                    ? `${Math.round(stats.avgIntervalSec/60)} นาที`
                    : `${stats.avgIntervalSec} วิ`],
                  ['Coverage',  `${stats.coverage}%`],
                  ['Gap',       stats.gapCount > 0
                    ? `${stats.gapCount} ครั้ง (นานสุด ${fmtDuration(stats.longestGapMs)})`
                    : 'ไม่มี'],
                ].map(([k, v]) => (
                  <div key={k} style={{ fontSize:11, color:'#94a3b8' }}>
                    <span style={{ fontWeight:700, color:'#64748b' }}>{k}: </span>{v}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── View Tabs ── */}
          <div style={{ borderBottom:'1px solid #f1f5f9',
            display:'flex', paddingLeft:12, background:'#fafbfc' }}>
            {tabs.map(t => (
              <ViewTab key={t.id} id={t.id} label={t.label}
                active={tab===t.id} onClick={id => { setTab(id); setPage(0); }}/>
            ))}
          </div>

          {/* ── Tab: Chart ── */}
          {tab === 'chart' && (
            <div style={{ padding:'14px 8px 8px' }}>
              {loading ? (
                <LoadingDots color={color} height={200}/>
              ) : chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={showBrush ? 240 : 200}>
                  <AreaChart data={chartData} margin={{ top:12, right:16, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={color} stopOpacity={0.18}/>
                        <stop offset="100%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="time" type="number" scale="time"
                      domain={['dataMin','dataMax']} ticks={ticks}
                      tickFormatter={ts => fmtTick(ts, rangeHours)}
                      tick={{ fontSize:11, fill:'#94a3b8' }}
                      axisLine={false} tickLine={false} minTickGap={36}/>
                    <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#94a3b8' }}
                      tickFormatter={v => `${v}%`} width={36} axisLine={false} tickLine={false}/>
                    <ReferenceLine y={pond.thresholdYellow} stroke="#d97706"
                      strokeDasharray="5 4" strokeWidth={1.5}
                      label={{ value:`เตือน ${pond.thresholdYellow}%`,
                        position:'insideTopLeft', fontSize:10, fill:'#d97706', fontWeight:700 }}/>
                    <ReferenceLine y={pond.thresholdRed} stroke="#dc2626"
                      strokeDasharray="5 4" strokeWidth={1.5}
                      label={{ value:`วิกฤต ${pond.thresholdRed}%`,
                        position:'insideTopLeft', fontSize:10, fill:'#dc2626', fontWeight:700 }}/>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const rp = enriched.find(x => x.time === d.time);
                        return (
                          <div style={{ background:'#fff', border:'1px solid #e2e8f0',
                            padding:'10px 14px', borderRadius:12, fontSize:12,
                            boxShadow:'0 4px 16px rgba(0,0,0,.1)', minWidth:170 }}>
                            <div style={{ fontWeight:800, color, fontSize:18, marginBottom:4 }}>
                              {d.v?.toFixed(1)}%
                            </div>
                            {rp && <>
                              <div style={{ color:'#475569', marginBottom:2 }}>
                                ความสูง: <b>{rp.wh.toFixed(1)} ซม.</b>
                              </div>
                              <div style={{ color:'#475569', marginBottom:4 }}>
                                ปริมาตร: <b>{rp.volume.toFixed(3)} ม³</b>
                              </div>
                              {rp.deltaRate != null && (
                                <div style={{ marginBottom:4, fontSize:11, fontWeight:700,
                                  color: Math.abs(rp.deltaRate)>5?'#dc2626':Math.abs(rp.deltaRate)>2?'#d97706':'#16a34a' }}>
                                  Δ {rp.deltaRate>0?'+':''}{rp.deltaRate.toFixed(1)}%/ชม.
                                </div>
                              )}
                              <StatusChip status={rp.status} small/>
                            </>}
                            <div style={{ color:'#94a3b8', marginTop:6, fontSize:11 }}>
                              {fmtTs(d.time)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5}
                      fill={`url(#${gradId})`} dot={false} isAnimationActive={false}/>
                    {showBrush && (
                      <Brush dataKey="time" height={22} stroke="#e2e8f0" fill="#f8fafc"
                        travellerWidth={6} tickFormatter={ts => fmtTick(ts, rangeHours)}/>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart/>
              )}
            </div>
          )}

          {/* ── Tab: Hourly ── */}
          {tab === 'hourly' && (
            <div>
              {loading ? <LoadingDots color={color} height={150}/> : hourlyAgg.length === 0 ? <EmptyChart/> : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                        {['ชั่วโมง','เฉลี่ย %','ต่ำสุด','สูงสุด','ช่วง (0–100%)','readings','สถานะ'].map((h, i) => (
                          <th key={i} style={{ padding:'10px 14px',
                            textAlign: i===0||i===5||i===6 ? 'center' : 'left',
                            fontSize:11, fontWeight:700, color:'#64748b',
                            textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyAgg.map((row, i) => {
                        const sc = getStatusColor(row.status);
                        return (
                          <tr key={row.ts} className="tbl-row"
                            style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ padding:'9px 14px', fontFamily:'monospace',
                              fontSize:11, color:'#475569', whiteSpace:'nowrap' }}>
                              {fmtHour(row.ts)}
                            </td>
                            <td style={{ padding:'9px 14px', fontWeight:800,
                              color:sc, fontSize:15 }}>{row.avg}%</td>
                            <td style={{ padding:'9px 14px', color:'#16a34a', fontWeight:700 }}>{row.min}%</td>
                            <td style={{ padding:'9px 14px', color:'#dc2626', fontWeight:700 }}>{row.max}%</td>
                            <td style={{ padding:'9px 20px 9px 14px', minWidth:120 }}>
                              <RangeBar min={row.min} max={row.max} value={row.avg}
                                low={pond.thresholdYellow} high={pond.thresholdRed}/>
                            </td>
                            <td style={{ padding:'9px 14px', textAlign:'center',
                              color:'#64748b', fontWeight:600 }}>{row.count}</td>
                            <td style={{ padding:'9px 14px', textAlign:'center' }}>
                              <StatusChip status={row.status} small/>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Daily ── */}
          {tab === 'daily' && (
            <div>
              {loading ? <LoadingDots color={color} height={150}/> : dailyAgg.length === 0 ? <EmptyChart/> : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                        {['วันที่','เฉลี่ย %','ต่ำสุด','สูงสุด','ช่วง (0–100%)','Δ วัน','readings','สถานะ'].map((h, i) => (
                          <th key={i} style={{ padding:'10px 14px',
                            textAlign: i===5||i===6||i===7 ? 'center' : 'left',
                            fontSize:11, fontWeight:700, color:'#64748b',
                            textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyAgg.map(row => {
                        const sc = getStatusColor(row.status);
                        return (
                          <tr key={row.ts} className="tbl-row"
                            style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ padding:'9px 14px', fontWeight:700,
                              color:'#374151', whiteSpace:'nowrap' }}>{fmtDay(row.ts)}</td>
                            <td style={{ padding:'9px 14px', fontWeight:800,
                              color:sc, fontSize:15 }}>{row.avg}%</td>
                            <td style={{ padding:'9px 14px', color:'#16a34a', fontWeight:700 }}>{row.min}%</td>
                            <td style={{ padding:'9px 14px', color:'#dc2626', fontWeight:700 }}>{row.max}%</td>
                            <td style={{ padding:'9px 20px 9px 14px', minWidth:120 }}>
                              <RangeBar min={row.min} max={row.max} value={row.avg}
                                low={pond.thresholdYellow} high={pond.thresholdRed}/>
                            </td>
                            <td style={{ padding:'9px 14px', textAlign:'center' }}>
                              <DeltaCell deltaRate={row.trend} small/>
                            </td>
                            <td style={{ padding:'9px 14px', textAlign:'center',
                              color:'#64748b', fontWeight:600 }}>{row.count}</td>
                            <td style={{ padding:'9px 14px', textAlign:'center' }}>
                              <StatusChip status={row.status} small/>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Raw Data Table ── */}
          {tab === 'raw' && (
            <div>
              {/* Status filter */}
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #f1f5f9',
                display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>กรอง:</span>
                {[
                  { id:'all',     label:'ทั้งหมด',  c:'#64748b' },
                  { id:'normal',  label:'ปกติ',     c:'#16a34a' },
                  { id:'warning', label:'เตือน',    c:'#d97706' },
                  { id:'danger',  label:'วิกฤต',    c:'#dc2626' },
                ].map(f => (
                  <button key={f.id} className="stf-btn"
                    onClick={() => { setStFilter(f.id); setPage(0); }}
                    style={{
                      background: stFilter===f.id ? f.c : '#f8fafc',
                      color:      stFilter===f.id ? '#fff' : '#64748b',
                      border:     stFilter===f.id ? `1.5px solid ${f.c}` : '1.5px solid #e2e8f0',
                    }}>{f.label}</button>
                ))}
                <span style={{ fontSize:11, color:'#94a3b8', marginLeft:8 }}>
                  {tableRows.length.toLocaleString()} รายการ
                </span>
              </div>

              {loading ? <LoadingDots color={color} height={150}/> : tableRows.length === 0 ? <EmptyChart/> : (
                <>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                          {['#','วันเวลา','ระดับ %','ความสูง ซม.','ปริมาตร ม³','สถานะ','แบต','Δ %/ชม.'].map((h, i) => (
                            <th key={i} style={{ padding:'10px 14px',
                              textAlign: i===0 ? 'center' : 'left',
                              fontSize:11, fontWeight:700, color:'#64748b',
                              textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => {
                          const rowNum = tableRows.length - (page * PAGE_SIZE + i);
                          const sc     = getStatusColor(row.status);
                          const isMin  = minPct != null && row.pct === minPct;
                          const isMax  = maxPct != null && row.pct === maxPct;
                          return (
                            <tr key={row.time} className="tbl-row"
                              style={{ borderBottom:'1px solid #f1f5f9',
                                borderLeft: isMax ? '3px solid #dc2626'
                                          : isMin ? '3px solid #16a34a' : '3px solid transparent' }}>
                              <td style={{ padding:'7px 14px', textAlign:'center',
                                color:'#94a3b8', fontWeight:600, fontSize:11 }}>
                                {rowNum}
                                {(isMin || isMax) && (
                                  <span style={{ marginLeft:4, fontSize:10,
                                    color: isMax ? '#dc2626' : '#16a34a', fontWeight:800 }}>
                                    {isMax ? '▲MAX' : '▼MIN'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding:'7px 14px', color:'#374151',
                                whiteSpace:'nowrap', fontFamily:'monospace', fontSize:11 }}>
                                {fmtTs(row.time)}
                              </td>
                              <td style={{ padding:'7px 14px', fontWeight:800,
                                color:sc, fontSize:14 }}>{row.pct.toFixed(2)}%</td>
                              <td style={{ padding:'7px 14px', color:'#374151',
                                fontWeight:600 }}>{row.wh.toFixed(1)}</td>
                              <td style={{ padding:'7px 14px', color:'#374151',
                                fontWeight:600 }}>{row.volume.toFixed(3)}</td>
                              <td style={{ padding:'7px 14px' }}>
                                <StatusChip status={row.status} small/>
                              </td>
                              <td style={{ padding:'7px 14px', color:'#374151' }}>
                                {row.battery != null ? `${row.battery}%` : <span style={{ color:'#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding:'7px 14px' }}>
                                <DeltaCell deltaRate={row.deltaRate}/>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{ padding:'10px 20px', borderTop:'1px solid #f1f5f9',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    flexWrap:'wrap', gap:8 }}>
                    <div style={{ fontSize:12, color:'#64748b' }}>
                      {tableRows.length > 0
                        ? `แสดง ${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE, tableRows.length)} จาก ${tableRows.length.toLocaleString()} รายการ`
                        : 'ไม่มีข้อมูล'}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onPage={setPage} color={color}/>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Alert Events ── */}
          {!loading && alertEvents.length > 0 && (
            <div style={{ borderTop:'2px solid #f1f5f9' }}>
              <button onClick={() => setShowAlerts(v => !v)}
                style={{ width:'100%', padding:'10px 20px', background:'none', border:'none',
                  cursor:'pointer', display:'flex', alignItems:'center', gap:8,
                  fontSize:13, fontWeight:700, color:'#475569' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="#d97706" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Alert Events
                <span style={{ padding:'1px 8px', borderRadius:20,
                  background: alertEvents.some(e=>e.to==='danger') ? '#fef2f2' : '#fffbeb',
                  color:      alertEvents.some(e=>e.to==='danger') ? '#dc2626' : '#d97706',
                  fontSize:11, fontWeight:800 }}>
                  {alertEvents.length}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ marginLeft:'auto', transform: showAlerts ? 'rotate(180deg)' : 'none',
                    transition:'transform .2s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showAlerts && (
                <div style={{ maxHeight:280, overflowY:'auto' }}>
                  {alertEvents.map((ev, i) => <AlertEventRow key={i} ev={ev}/>)}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────
function LoadingDots({ color, height }) {
  return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', gap:6 }}>
        {[0, .15, .3].map(d => (
          <div key={d} style={{ width:8, height:8, borderRadius:'50%', background:color,
            animation:`blink 1.2s ${d}s ease-in-out infinite` }}/>
        ))}
      </div>
    </div>
  );
}
function EmptyChart() {
  return (
    <div style={{ height:130, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:8,
      background:'#f8fafc', borderRadius:12, margin:12 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
      <span style={{ fontSize:13, color:'#94a3b8', fontWeight:500 }}>
        ไม่มีข้อมูลสำหรับช่วงวันที่เลือก
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  iconBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'#f8fafc', border:'1px solid #e2e8f0',
    borderRadius:8, width:32, height:32, cursor:'pointer', color:'#64748b', padding:0,
  },
  dateInput: {
    padding:'5px 10px', borderRadius:8, fontSize:12,
    border:'1.5px solid #e2e8f0', color:'#374151',
    background:'#f8fafc', outline:'none', cursor:'pointer',
  },
};
