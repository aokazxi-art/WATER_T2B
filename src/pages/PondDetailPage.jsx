import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import TankGauge   from '../components/TankGauge';
import StatusBadge from '../components/StatusBadge';
import { getStatusColor } from '../utils/waterLevel';
import { loadDailyHistoryAsync } from '../hooks/usePondData';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_TH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                          'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const PRESETS = [
  { id: 'today',  label: 'วันนี้'    },
  { id: '7d',     label: '7 วัน'     },
  { id: '30d',    label: '30 วัน'    },
  { id: 'custom', label: 'กำหนดเอง' },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate()-n); return d;
}
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
  return chunks.flat().sort((a,b) => a.time - b.time);
}
function fmtRange(s, e) {
  if (!s||!e) return '';
  const a = new Date(s+'T00:00:00'), b = new Date(e+'T00:00:00');
  const full  = d => `${d.getDate()} ${MONTHS_TH_SHORT[d.getMonth()]} ${d.getFullYear()+543}`;
  const short = d => `${d.getDate()} ${MONTHS_TH_SHORT[d.getMonth()]}`;
  if (s===e) return full(a);
  return a.getFullYear()===b.getFullYear() ? `${short(a)} – ${full(b)}` : `${full(a)} – ${full(b)}`;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildTicks(data) {
  if (data.length<2) return [];
  const tMin=data[0].time, tMax=data[data.length-1].time;
  const h=(tMax-tMin)/3_600_000;
  const step = h<=4?1 : h<=9?2 : h<=18?3 : h<=36?6 : h<=72?12 : h<=168?24 : Math.ceil(h/8);
  const sm=step*3_600_000, ft=Math.ceil(tMin/sm)*sm, ticks=[];
  for (let t=ft; t<=tMax; t+=sm) ticks.push(t);
  return ticks;
}
function fmtTick(ts, h) {
  const d = new Date(ts);
  if (h<=36)  return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  if (h<=168) return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:00`;
  return `${d.getDate()}/${d.getMonth()+1}`;
}
function fmtTT(ts, h) {
  const d = new Date(ts);
  if (h<=36) return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  return `${d.getDate()} ${MONTHS_TH_SHORT[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroStat({ label, value, unit, accent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700,
        textTransform:'uppercase', letterSpacing:'0.1em' }}>
        {label}
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
        <span style={{ fontSize:27, fontWeight:800, lineHeight:1,
          color: value!=null ? (accent||'#0f172a') : '#e2e8f0' }}>
          {value ?? '—'}
        </span>
        {unit && value!=null && (
          <span style={{ fontSize:12, color:'#94a3b8', fontWeight:500 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{ flex:1, textAlign:'center', padding:'10px 8px',
      background: `${accent}0d`, borderRadius:10,
      border: `1px solid ${accent}22` }}>
      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600,
        textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>
        {label}
      </div>
      <div style={{ fontSize:18, fontWeight:800, color:accent }}>{value}%</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PondDetailPage({ pondId, getPondState, onBack, onOpenSettings, onLogout }) {
  const todayStr = dateToStr(new Date());

  const [preset,  setPreset]  = useState('today');
  const [cStart,  setCStart]  = useState(todayStr);
  const [cEnd,    setCEnd]    = useState(todayStr);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);

  const state = getPondState(pondId);
  const { start, end } = getDateRange(preset, cStart, cEnd);

  useEffect(() => {
    if (!state?.pond || !start || !end) return;
    let cancelled = false;
    setLoading(true);
    loadRange(state.pond.id, start, end).then(d => {
      if (!cancelled) { setData(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [state?.pond?.id, start, end]);

  if (!state) return null;

  const { pond, dist, waterHeight, pct, volume, status } = state;
  const color  = getStatusColor(status);
  const gradId = `grad-${pond.id}`;

  const chartData  = data.map(x => ({ time:x.time, v:x.pct }));
  const rangeHours = chartData.length>=2
    ? (chartData[chartData.length-1].time - chartData[0].time) / 3_600_000 : 24;
  const ticks = buildTicks(chartData);
  const avg   = data.length ? (data.reduce((s,x)=>s+x.pct,0)/data.length).toFixed(1) : null;
  const dMin  = data.length ? Math.min(...data.map(x=>x.pct)).toFixed(1) : null;
  const dMax  = data.length ? Math.max(...data.map(x=>x.pct)).toFixed(1) : null;

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f8' }}>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .anim-1 { animation: fadeUp .35s ease both; }
        .anim-2 { animation: fadeUp .35s .1s ease both; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity:.5; cursor:pointer; }
      `}</style>

      {/* ── Navbar ────────────────────────────────────────── */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #e8edf3',
        padding:'0 24px', height:54,
        display:'flex', alignItems:'center', gap:12,
        position:'sticky', top:0, zIndex:20,
        boxShadow:'0 1px 8px rgba(0,0,0,.06)',
      }}>
        <button onClick={onBack} style={{
          display:'flex', alignItems:'center', gap:5,
          background:'none', border:'none', cursor:'pointer',
          fontSize:13, fontWeight:600, color:'#64748b', padding:'4px 2px',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          กลับ
        </button>

        <div style={{ width:1, height:20, background:'#e2e8f0' }} />

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#0f172a',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {pond.name}
            </span>
            <StatusBadge status={status} />
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>
            {(pond.area/10000).toFixed(2)} ม²  ·  ลึก {pond.depth} ซม.  ·  offset {pond.sensorOffset} ซม.
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {onOpenSettings && (
            <button onClick={onOpenSettings} title="Settings" style={iconBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
          <button onClick={onLogout} style={{ ...iconBtn, width:'auto', padding:'0 12px', fontSize:12 }}>
            ออก
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div style={{ maxWidth:960, margin:'0 auto', padding:'24px 20px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* ── Hero card (light) ── */}
        <div className="anim-1" style={{
          background:'#fff',
          borderRadius:20, padding:'28px 28px',
          border:'1px solid #e8edf3',
          boxShadow:'0 2px 16px rgba(15,30,53,.07)',
          display:'flex', gap:24, flexWrap:'wrap', alignItems:'center',
        }}>
          {/* Tank */}
          <TankGauge
            pondWidth={Math.sqrt(pond.area)}
            pondDepth={pond.depth}
            fillPercent={pct ?? 0}
            status={status}
            id={`large-${pond.id}`}
            size="large"
          />

          {/* Stats */}
          <div style={{ flex:1, minWidth:180, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'22px 32px' }}>
            <HeroStat label="ระดับน้ำ"     value={pct!=null ? pct.toFixed(1) : null}                                                                                              unit="%"   accent={color}     />
            <HeroStat label="ความสูงน้ำ"   value={waterHeight!=null ? Math.max(0,waterHeight).toFixed(1) : null}                                                                  unit="ซม." accent="#0284c7"   />
            <HeroStat label="ปริมาณน้ำ"    value={volume!=null ? Math.max(0,volume).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : null}             unit="ม³"  accent="#6366f1"   />
            <HeroStat label="ระยะเซนเซอร์" value={dist!=null ? dist.toFixed(1) : null}                                                                                            unit="ซม." accent="#64748b"   />
          </div>
        </div>

        {/* ── Level History card (light) ── */}
        <div className="anim-2" style={{
          background:'#fff', borderRadius:20,
          border:'1px solid #e8edf3',
          boxShadow:'0 2px 16px rgba(15,30,53,.07)',
          overflow:'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding:'16px 20px',
            borderBottom:'1px solid #f1f5f9',
            display:'flex', alignItems:'center', gap:10,
          }}>
            <div style={{
              width:32, height:32, borderRadius:9,
              background:`linear-gradient(135deg, ${color}20, ${color}08)`,
              border:`1.5px solid ${color}30`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Level History</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{fmtRange(start, end)}</div>
            </div>
            <div style={{ marginLeft:'auto', fontSize:11, fontWeight:600,
              color: loading ? '#0284c7' : '#94a3b8',
              background: loading ? '#e0f2fe' : '#f8fafc',
              borderRadius:20, padding:'3px 10px' }}>
              {loading ? 'กำลังโหลด...' : `${data.length} readings`}
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div style={{
            padding:'12px 20px',
            borderBottom:'1px solid #f1f5f9',
            display:'flex', flexWrap:'wrap', gap:6, alignItems:'center',
          }}>
            {PRESETS.map(p => {
              const active = preset===p.id;
              return (
                <button key={p.id} onClick={() => setPreset(p.id)} style={{
                  padding:'6px 16px', borderRadius:20,
                  fontSize:12, fontWeight:700, cursor:'pointer',
                  transition:'all .18s',
                  border: active ? 'none' : '1.5px solid #e2e8f0',
                  background: active ? color : '#f8fafc',
                  color: active ? '#fff' : '#64748b',
                  boxShadow: active ? `0 2px 10px ${color}40` : 'none',
                }}>{p.label}</button>
              );
            })}

            {preset==='custom' && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:4, flexWrap:'wrap' }}>
                <div style={{ width:1, height:18, background:'#e2e8f0' }}/>
                <input type="date" value={cStart} max={cEnd||todayStr}
                  onChange={e=>setCStart(e.target.value)} style={dateInput}/>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
                <input type="date" value={cEnd} min={cStart} max={todayStr}
                  onChange={e=>setCEnd(e.target.value)} style={dateInput}/>
              </div>
            )}
          </div>

          {/* Stats avg / min / max */}
          {data.length>0 && (
            <div style={{ display:'flex', gap:8, padding:'14px 20px 0' }}>
              <StatPill label="เฉลี่ย" value={avg}  accent={color}     />
              <StatPill label="ต่ำสุด" value={dMin} accent="#16a34a"   />
              <StatPill label="สูงสุด" value={dMax} accent="#dc2626"   />
            </div>
          )}

          {/* Chart */}
          <div style={{ padding:'12px 8px 20px' }}>
            {loading ? (
              <div style={{ height:150, borderRadius:12, background:'#f8fafc',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {[0,.15,.3].map(d => (
                    <div key={d} style={{
                      width:8, height:8, borderRadius:'50%', background:color,
                      animation:`blink 1.2s ${d}s ease-in-out infinite`,
                    }}/>
                  ))}
                </div>
              </div>
            ) : chartData.length>=2 ? (
              <ResponsiveContainer width="100%" height={175}>
                <AreaChart data={chartData} margin={{ top:6, right:12, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity={0.18}/>
                      <stop offset="100%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
                  <XAxis
                    dataKey="time" type="number" scale="time"
                    domain={['dataMin','dataMax']}
                    ticks={ticks}
                    tickFormatter={ts => fmtTick(ts, rangeHours)}
                    tick={{ fontSize:11, fill:'#94a3b8' }}
                    axisLine={false} tickLine={false} minTickGap={36}
                  />
                  <YAxis
                    domain={[0,100]}
                    tick={{ fontSize:11, fill:'#94a3b8' }}
                    tickFormatter={v => `${v}%`}
                    width={36} axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active||!payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background:'#fff', border:`1px solid #e2e8f0`,
                          padding:'8px 12px', borderRadius:10, fontSize:12,
                          boxShadow:'0 4px 16px rgba(0,0,0,.1)',
                        }}>
                          <div style={{ fontWeight:800, color, fontSize:16 }}>
                            {d.v?.toFixed(1)}%
                          </div>
                          <div style={{ color:'#94a3b8', marginTop:2, fontSize:11 }}>
                            {fmtTT(d.time, rangeHours)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone" dataKey="v"
                    stroke={color} strokeWidth={2.5}
                    fill={`url(#${gradId})`}
                    dot={false} isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{
                height:130, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:8,
                background:'#f8fafc', borderRadius:12,
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
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
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const iconBtn = {
  display:'flex', alignItems:'center', justifyContent:'center',
  background:'#f8fafc', border:'1px solid #e2e8f0',
  borderRadius:8, width:32, height:32, cursor:'pointer', color:'#64748b', padding:0,
};

const dateInput = {
  padding:'5px 10px', borderRadius:8, fontSize:12,
  border:'1.5px solid #e2e8f0', color:'#374151',
  background:'#f8fafc', outline:'none', cursor:'pointer',
};
