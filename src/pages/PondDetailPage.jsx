import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import TankGauge from '../components/TankGauge';
import StatusBadge from '../components/StatusBadge';
import { getStatusColor } from '../utils/waterLevel';
import { loadDailyHistoryAsync } from '../hooks/usePondData';

const DAYS_TH        = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH      = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTHS_TH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                          'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function buildHourlyTicks(data) {
  if (data.length < 2) return [];
  const tMin = data[0].time;
  const tMax = data[data.length - 1].time;
  const rangeHours = (tMax - tMin) / 3_600_000;

  // เลือก interval: 1h / 2h / 3h / 6h ตาม range
  let step = 1;
  if (rangeHours > 18) step = 6;
  else if (rangeHours > 9) step = 3;
  else if (rangeHours > 4) step = 2;

  const stepMs = step * 3_600_000;
  // จุดเริ่มต้น = ชั่วโมงถัดไปที่ตรงชั่วโมง
  const firstTick = Math.ceil(tMin / stepMs) * stepMs;
  const ticks = [];
  for (let t = firstTick; t <= tMax; t += stepMs) ticks.push(t);
  return ticks;
}

function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDaysWithData(pondId, year, month) {
  const days = new Set();
  for (let d = 1; d <= 31; d++) {
    try {
      const raw = localStorage.getItem(`water_daily_${pondId}_${toDateKey(year, month, d)}`);
      if (raw && raw !== '[]') days.add(d);
    } catch (_) {}
  }
  return days;
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

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

export default function PondDetailPage({ pondId, getPondState, updatePond, onBack, onOpenSettings, user, onLogout }) {
  const today = new Date();
  const [viewYear,        setViewYear]        = useState(today.getFullYear());
  const [viewMonth,       setViewMonth]       = useState(today.getMonth());
  const [selectedDate,    setSelectedDate]    = useState(today);
  const [dailyData,       setDailyData]       = useState([]);
  const [calMode,    setCalMode]    = useState('day'); // 'day' | 'month' | 'year'
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  const state = getPondState(pondId);

  useEffect(() => {
    if (!state?.pond) return;
    let cancelled = false;
    loadDailyHistoryAsync(state.pond.id, selectedDate).then(data => {
      if (!cancelled) setDailyData(data);
    });
    return () => { cancelled = true; };
  }, [state?.pond?.id, selectedDate]);

  const daysWithData = useMemo(
    () => state?.pond ? getDaysWithData(state.pond.id, viewYear, viewMonth) : new Set(),
    [state?.pond?.id, viewYear, viewMonth, dailyData]
  );

  if (!state) return null;
  const { pond, dist, waterHeight, pct, volume, status, history } = state;
  const color = getStatusColor(status);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (new Date(viewYear, viewMonth + 1, 1) <= today) {
      if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
      else setViewMonth(m => m + 1);
    }
  }
  function selectDay(day) {
    if (!day) return;
    const d = new Date(viewYear, viewMonth, day);
    if (d > today) return;
    setSelectedDate(d);
  }

  const cells = buildCalendar(viewYear, viewMonth);
  const isNextDisabled = new Date(viewYear, viewMonth + 1, 1) > today;
  const selDay   = selectedDate.getDate();
  const selMonth = selectedDate.getMonth();
  const selYear  = selectedDate.getFullYear();

  const chartData = dailyData.map(item => ({ time: item.time, v: item.pct }));
  const avg = dailyData.length ? (dailyData.reduce((s, x) => s + x.pct, 0) / dailyData.length).toFixed(1) : null;
  const dMin = dailyData.length ? Math.min(...dailyData.map(x => x.pct)).toFixed(1) : null;
  const dMax = dailyData.length ? Math.max(...dailyData.map(x => x.pct)).toFixed(1) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* Navbar */}
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

      {/* Page content */}
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

            {/* Stats */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Stat label="ระดับน้ำ"     value={pct      != null ? pct.toFixed(1)                                                                                     : '—'} unit="%" color={color} />
              <Stat label="ความสูงน้ำ"   value={waterHeight != null ? Math.max(0, waterHeight).toFixed(1)                                                     : '—'} unit="ซม." />
              <Stat label="ปริมาณน้ำ"    value={volume   != null ? Math.max(0, volume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} unit="ม³" minWidth={170} />
              <Stat label="ระยะเซนเซอร์" value={dist     != null ? dist.toFixed(1)                                                                            : '—'} unit="ซม." />
            </div>

            {/* Level History */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>

              {/* Header */}
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'baseline', gap: 8,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Level History</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {selDay} {MONTHS_TH[selMonth]} {selYear + 543}
                </span>
                <span style={{ fontSize: 11, color: '#cbd5e1', marginLeft: 'auto' }}>
                  {dailyData.length} readings
                </span>
              </div>

              {/* Stats avg/min/max */}
              {dailyData.length > 0 && (
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
              <div style={{ padding: '8px 8px 0' }}>
                {chartData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="time"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        ticks={buildHourlyTicks(chartData)}
                        tickFormatter={fmtTime}
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
                              <div style={{ color: '#94a3b8' }}>{fmtTime(d.time)}</div>
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
                    ไม่มีข้อมูลสำหรับวันที่เลือก
                  </div>
                )}
              </div>

              {/* Calendar */}
              <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f1f5f9', marginTop: 4 }}>

                {/* ── YEAR PICKER ── */}
                {calMode === 'year' && (() => {
                  const pageStart = Math.floor(pickerYear / 12) * 12;
                  const pageEnd   = pageStart + 11;
                  const canNext   = pageStart + 12 <= today.getFullYear();
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <button onClick={() => setPickerYear(pageStart - 1)} style={navBtn}>‹</button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                          {pageStart + 543} – {pageEnd + 543}
                        </span>
                        <button
                          onClick={() => { if (canNext) setPickerYear(pageStart + 12); }}
                          style={{ ...navBtn, color: canNext ? '#475569' : '#cbd5e1', cursor: canNext ? 'pointer' : 'default' }}
                        >›</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                        {Array.from({ length: 12 }, (_, i) => pageStart + i).map(yr => {
                          const isFuture = yr > today.getFullYear();
                          const isActive = yr === viewYear;
                          return (
                            <button
                              key={yr}
                              disabled={isFuture}
                              onClick={() => { setPickerYear(yr); setCalMode('month'); }}
                              style={{
                                padding: '8px 2px', borderRadius: 6, border: 'none',
                                cursor: isFuture ? 'default' : 'pointer',
                                fontSize: 11, fontWeight: isActive ? 700 : 400,
                                background: isActive ? color : 'transparent',
                                color: isFuture ? '#d1d5db' : isActive ? '#fff' : '#374151',
                              }}
                              onMouseEnter={e => { if (!isFuture && !isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                            >{yr + 543}</button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* ── MONTH PICKER ── */}
                {calMode === 'month' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <button onClick={() => setPickerYear(y => y - 1)} style={navBtn}>‹</button>
                      <button
                        onClick={() => setCalMode('year')}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, color: '#0f172a', padding: '2px 4px', borderRadius: 5,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        {pickerYear + 543}
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setPickerYear(y => Math.min(y + 1, today.getFullYear()))}
                        disabled={pickerYear >= today.getFullYear()}
                        style={{ ...navBtn, color: pickerYear >= today.getFullYear() ? '#cbd5e1' : '#475569', cursor: pickerYear >= today.getFullYear() ? 'default' : 'pointer' }}
                      >›</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                      {MONTHS_TH_SHORT.map((name, i) => {
                        const isFuture = pickerYear > today.getFullYear() ||
                          (pickerYear === today.getFullYear() && i > today.getMonth());
                        const isActive = pickerYear === viewYear && i === viewMonth;
                        return (
                          <button
                            key={i}
                            disabled={isFuture}
                            onClick={() => { setViewYear(pickerYear); setViewMonth(i); setCalMode('day'); }}
                            style={{
                              padding: '8px 2px', borderRadius: 6, border: 'none',
                              cursor: isFuture ? 'default' : 'pointer',
                              fontSize: 11, fontWeight: isActive ? 600 : 400,
                              background: isActive ? color : 'transparent',
                              color: isFuture ? '#d1d5db' : isActive ? '#fff' : '#374151',
                            }}
                            onMouseEnter={e => { if (!isFuture && !isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                          >{name}</button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── DAY PICKER ── */}
                {calMode === 'day' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <button onClick={prevMonth} style={navBtn}>‹</button>
                      <button
                        onClick={() => { setPickerYear(viewYear); setCalMode('year'); }}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, color: '#0f172a', padding: '2px 4px', borderRadius: 5,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        {MONTHS_TH[viewMonth]} {viewYear + 543}
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      <button
                        onClick={nextMonth}
                        disabled={isNextDisabled}
                        style={{ ...navBtn, color: isNextDisabled ? '#cbd5e1' : '#475569', cursor: isNextDisabled ? 'default' : 'pointer' }}
                      >›</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
                      {DAYS_TH.map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{d}</div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                      {cells.map((day, i) => {
                        if (!day) return <div key={`e${i}`} />;
                        const cellDate   = new Date(viewYear, viewMonth, day);
                        const isFuture   = cellDate > today;
                        const isToday_   = cellDate.toDateString() === today.toDateString();
                        const isSelected = day === selDay && viewMonth === selMonth && viewYear === selYear;
                        const hasData    = daysWithData.has(day);
                        return (
                          <div
                            key={day}
                            onClick={() => !isFuture && selectDay(day)}
                            style={{
                              position: 'relative', textAlign: 'center',
                              padding: '4px 0', borderRadius: 5, fontSize: 11,
                              fontWeight: isToday_ ? 800 : 500,
                              cursor: isFuture ? 'default' : 'pointer',
                              color:      isFuture   ? '#e2e8f0'
                                        : isSelected ? '#fff'
                                        : isToday_   ? color
                                        : '#334155',
                              background: isSelected ? color : 'transparent',
                              border:     isToday_ && !isSelected ? `1.5px solid ${color}` : '1.5px solid transparent',
                              transition: 'background .12s',
                            }}
                          >
                            {day}
                            {hasData && !isSelected && (
                              <div style={{
                                position: 'absolute', bottom: 1, left: '50%',
                                transform: 'translateX(-50%)',
                                width: 3, height: 3, borderRadius: '50%',
                                background: color, opacity: 0.7,
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7,
  width: 32, height: 32, cursor: 'pointer', color: '#475569',
  padding: 0,
};

const navBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 16, color: '#475569', padding: '0 6px', lineHeight: 1,
};
