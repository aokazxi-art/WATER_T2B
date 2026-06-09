import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import TankGauge    from '../components/TankGauge';
import StatusBadge  from '../components/StatusBadge';
import { getStatusColor } from '../utils/waterLevel';
import { loadDailyHistoryAsync } from '../hooks/usePondData';

const MONTHS_TH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                          'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const PRESETS = [
  { id: 'today', label: 'วันนี้'    },
  { id: '7d',    label: '7 วัน'     },
  { id: '30d',   label: '30 วัน'    },
  { id: 'custom', label: 'กำหนดเอง' },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function getDaysInRange(startStr, endStr) {
  const days = [];
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr   + 'T00:00:00');
  if (isNaN(cur) || isNaN(end) || cur > end) return days;
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getDateRange(preset, customStart, customEnd) {
  const tod = dateToStr(new Date());
  switch (preset) {
    case 'today':  return { start: tod,                    end: tod };
    case '7d':     return { start: dateToStr(daysAgo(6)),  end: tod };
    case '30d':    return { start: dateToStr(daysAgo(29)), end: tod };
    case 'custom': return { start: customStart,            end: customEnd };
    default:       return { start: tod,                    end: tod };
  }
}

async function loadRangeData(pondId, startStr, endStr) {
  const days = getDaysInRange(startStr, endStr);
  if (!days.length) return [];
  const chunks = await Promise.all(days.map(d => loadDailyHistoryAsync(pondId, d)));
  return chunks.flat().sort((a, b) => a.time - b.time);
}

function fmtDateRange(startStr, endStr) {
  if (!startStr || !endStr) return '';
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr   + 'T00:00:00');
  const full  = d => `${d.getDate()} ${MONTHS_TH_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
  const short = d => `${d.getDate()} ${MONTHS_TH_SHORT[d.getMonth()]}`;
  if (startStr === endStr) return full(s);
  if (s.getFullYear() === e.getFullYear()) return `${short(s)} – ${full(e)}`;
  return `${full(s)} – ${full(e)}`;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildSmartTicks(data) {
  if (data.length < 2) return [];
  const tMin       = data[0].time;
  const tMax       = data[data.length - 1].time;
  const rangeHours = (tMax - tMin) / 3_600_000;

  let stepHours;
  if      (rangeHours <= 4)   stepHours = 1;
  else if (rangeHours <= 9)   stepHours = 2;
  else if (rangeHours <= 18)  stepHours = 3;
  else if (rangeHours <= 36)  stepHours = 6;
  else if (rangeHours <= 72)  stepHours = 12;
  else if (rangeHours <= 168) stepHours = 24;
  else                        stepHours = Math.ceil(rangeHours / 8);

  const stepMs    = stepHours * 3_600_000;
  const firstTick = Math.ceil(tMin / stepMs) * stepMs;
  const ticks     = [];
  for (let t = firstTick; t <= tMax; t += stepMs) ticks.push(t);
  return ticks;
}

function fmtTick(ts, rangeHours) {
  const d = new Date(ts);
  if (rangeHours <= 36)  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (rangeHours <= 168) return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:00`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtTooltipTime(ts, rangeHours) {
  const d = new Date(ts);
  if (rangeHours <= 36) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${d.getDate()} ${MONTHS_TH_SHORT[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, unit, color, minWidth = 110 }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '12px 14px',
      border: '1px solid #e2e8f0', flex: 1, minWidth,
    }}>
      <div style={{
        fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 5,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color || '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PondDetailPage({ pondId, getPondState, onBack, onOpenSettings, onLogout }) {
  const todayStr = dateToStr(new Date());

  const [rangePreset,  setRangePreset]  = useState('today');
  const [customStart,  setCustomStart]  = useState(todayStr);
  const [customEnd,    setCustomEnd]    = useState(todayStr);
  const [rangeData,    setRangeData]    = useState([]);
  const [loadingRange, setLoadingRange] = useState(false);

  const state = getPondState(pondId);

  const { start: rangeStart, end: rangeEnd } = getDateRange(rangePreset, customStart, customEnd);

  // โหลดข้อมูลใหม่ทุกครั้งที่ช่วงวันเปลี่ยน
  useEffect(() => {
    if (!state?.pond || !rangeStart || !rangeEnd) return;
    let cancelled = false;
    setLoadingRange(true);
    loadRangeData(state.pond.id, rangeStart, rangeEnd).then(data => {
      if (!cancelled) { setRangeData(data); setLoadingRange(false); }
    });
    return () => { cancelled = true; };
  }, [state?.pond?.id, rangeStart, rangeEnd]);

  if (!state) return null;
  const { pond, dist, waterHeight, pct, volume, status } = state;
  const color = getStatusColor(status);

  // ข้อมูลกราฟ
  const chartData  = rangeData.map(item => ({ time: item.time, v: item.pct }));
  const rangeHours = chartData.length >= 2
    ? (chartData[chartData.length - 1].time - chartData[0].time) / 3_600_000
    : 24;
  const ticks = buildSmartTicks(chartData);

  // สถิติ
  const avg  = rangeData.length ? (rangeData.reduce((s, x) => s + x.pct, 0) / rangeData.length).toFixed(1) : null;
  const dMin = rangeData.length ? Math.min(...rangeData.map(x => x.pct)).toFixed(1) : null;
  const dMax = rangeData.length ? Math.max(...rangeData.map(x => x.pct)).toFixed(1) : null;

  const rangeLabelText = fmtDateRange(rangeStart, rangeEnd);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* ── Navbar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: '#64748b', padding: '4px 0',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          กลับ
        </button>

        <div style={{ width: 1, height: 18, background: '#e2e8f0' }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pond.name}
            </span>
            <StatusBadge status={status} />
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {(pond.area / 10000).toFixed(2)} ม²  ·  ลึก {pond.depth} ซม.  ·  เซนเซอร์ {pond.sensorOffset} ซม.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onOpenSettings && (
            <button onClick={onOpenSettings} title="Settings" style={iconBtnStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
          <button onClick={onLogout} style={{ ...iconBtnStyle, fontSize: 12, padding: '5px 10px', color: '#64748b' }}>ออก</button>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Tank gauge */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '20px 16px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            flex: '0 0 auto',
          }}>
            <TankGauge
              pondWidth={Math.sqrt(pond.area)}
              pondDepth={pond.depth}
              fillPercent={pct ?? 0}
              status={status}
              id={`large-${pond.id}`}
              size="large"
            />
            <StatusBadge status={status} />
          </div>

          {/* Right column */}
          <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stats cards */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Stat label="ระดับน้ำ"     value={pct         != null ? pct.toFixed(1)                                                                                       : '—'} unit="%" color={color} />
              <Stat label="ความสูงน้ำ"   value={waterHeight  != null ? Math.max(0, waterHeight).toFixed(1)                                                       : '—'} unit="ซม." />
              <Stat label="ปริมาณน้ำ"    value={volume       != null ? Math.max(0, volume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} unit="ม³" minWidth={170} />
              <Stat label="ระยะเซนเซอร์" value={dist         != null ? dist.toFixed(1)                                                                              : '—'} unit="ซม." />
            </div>

            {/* ── Level History ── */}
            <div style={{
              background: '#fff', borderRadius: 10,
              border: '1px solid #e2e8f0', overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            }}>

              {/* Header */}
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'baseline', gap: 8,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Level History</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{rangeLabelText}</span>
                <span style={{ fontSize: 11, color: '#cbd5e1', marginLeft: 'auto' }}>
                  {loadingRange ? 'กำลังโหลด...' : `${rangeData.length} readings`}
                </span>
              </div>

              {/* ── Filter bar ── */}
              <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
              }}>
                {/* Preset buttons */}
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setRangePreset(p.id)}
                    style={{
                      padding: '5px 13px', borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      border:      rangePreset === p.id ? 'none' : '1px solid #e2e8f0',
                      background:  rangePreset === p.id ? color  : '#f8fafc',
                      color:       rangePreset === p.id ? '#fff' : '#475569',
                      cursor: 'pointer', transition: 'background .15s, color .15s',
                    }}
                  >{p.label}</button>
                ))}

                {/* Custom date inputs — แสดงเมื่อเลือก "กำหนดเอง" */}
                {rangePreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 2, flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd || todayStr}
                      onChange={e => setCustomStart(e.target.value)}
                      style={dateInputStyle}
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>ถึง</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      max={todayStr}
                      onChange={e => setCustomEnd(e.target.value)}
                      style={dateInputStyle}
                    />
                  </div>
                )}
              </div>

              {/* Stats avg / min / max */}
              {rangeData.length > 0 && (
                <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0' }}>
                  {[
                    { label: 'เฉลี่ย', value: avg,  c: color     },
                    { label: 'ต่ำสุด', value: dMin, c: '#22c55e' },
                    { label: 'สูงสุด', value: dMax, c: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, background: '#f8fafc', borderRadius: 8,
                      padding: '6px 10px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.value}%</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart */}
              <div style={{ padding: '8px 8px 14px' }}>
                {loadingRange ? (
                  <div style={{
                    height: 120, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#94a3b8', fontSize: 12,
                  }}>
                    กำลังโหลดข้อมูล...
                  </div>
                ) : chartData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="time"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        ticks={ticks}
                        tickFormatter={ts => fmtTick(ts, rangeHours)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        minTickGap={36}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        tickFormatter={v => `${v}%`}
                        width={34}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{
                              background: '#1e293b', color: '#fff',
                              padding: '6px 10px', borderRadius: 7, fontSize: 11,
                            }}>
                              <div style={{ fontWeight: 800 }}>{d.v?.toFixed(1)}%</div>
                              <div style={{ color: '#94a3b8' }}>{fmtTooltipTime(d.time, rangeHours)}</div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="v"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.15}
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    height: 100, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#94a3b8', fontSize: 12, gap: 4,
                  }}>
                    <span style={{ fontSize: 24 }}>📅</span>
                    ไม่มีข้อมูลสำหรับช่วงวันที่เลือก
                  </div>
                )}
              </div>

            </div>{/* end Level History */}
          </div>{/* end right column */}
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7,
  width: 32, height: 32, cursor: 'pointer', color: '#475569', padding: 0,
};

const dateInputStyle = {
  padding: '4px 8px', borderRadius: 7, fontSize: 12,
  border: '1px solid #e2e8f0', color: '#374151',
  background: '#f8fafc', cursor: 'pointer', outline: 'none',
};
