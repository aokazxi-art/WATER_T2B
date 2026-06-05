import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import TankGauge from '../components/TankGauge';
import StatusBadge from '../components/StatusBadge';
import { getStatusColor } from '../utils/waterLevel';
import { loadDailyHistoryAsync } from '../hooks/usePondData';

const DAYS_TH   = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                   'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

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

function Stat({ label, value, unit, color, minWidth = 120 }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 18px',
      border: '1.5px solid #e2e8f0', flex: 1, minWidth,
    }}>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#1e293b', whiteSpace: 'nowrap' }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

export default function PondDetailPage({ pondId, getPondState, updatePond, onBack, onOpenSettings, user, onLogout }) {
  const today = new Date();
  const [viewYear,   setViewYear]   = useState(today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [dailyData,  setDailyData]  = useState([]);

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={onBack} style={{
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
            padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 14,
          }}>← Back</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{pond.name}</h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              พื้นที่ {(pond.area / 10000).toFixed(2)} ม² | ลึก {pond.depth} ซม. | เซนเซอร์ห่างขอบ {pond.sensorOffset} ซม.
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={status} />

            {/* ปุ่ม Settings — แสดงเฉพาะ admin */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Settings"
                style={{
                  background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  width: 38, height: 38, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}

            {/* ปุ่ม Logout */}
            <button
              onClick={onLogout}
              title="ออกจากระบบ"
              style={{
                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                padding: '0 12px', height: 38, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#ef4444',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
            >ออก</button>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Tank gauge */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28,
            border: `2px solid ${color}44`, boxShadow: `0 4px 20px ${color}22`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
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
          <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Stat label="ระดับน้ำ"     value={pct      != null ? pct.toFixed(1)                                                                                     : '—'} unit="%" color={color} />
              <Stat label="ความสูงน้ำ"   value={waterHeight != null ? Math.max(0, waterHeight).toFixed(1)                                                     : '—'} unit="ซม." />
              <Stat label="ปริมาณน้ำ"    value={volume   != null ? Math.max(0, volume).toLocaleString('en-US', { maximumFractionDigits: 0 })                  : '—'} unit="ลิตร" minWidth={170} />
              <Stat label="ปริมาณน้ำ"    value={volume   != null ? (Math.max(0, volume) / 1000).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'} unit="ตัน" minWidth={170} />
              <Stat label="ระยะเซนเซอร์" value={dist     != null ? dist.toFixed(1)                                                                            : '—'} unit="ซม." />
            </div>

            {/* Level History — chart + calendar */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>

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
                {/* Month navigation */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <button onClick={prevMonth} style={navBtn}>‹</button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                    {MONTHS_TH[viewMonth]} {viewYear + 543}
                  </span>
                  <button
                    onClick={nextMonth}
                    disabled={isNextDisabled}
                    style={{ ...navBtn, color: isNextDisabled ? '#cbd5e1' : '#475569', cursor: isNextDisabled ? 'default' : 'pointer' }}
                  >›</button>
                </div>

                {/* Day name headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
                  {DAYS_TH.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
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
                          position: 'relative',
                          textAlign: 'center',
                          padding: '4px 0',
                          borderRadius: 5,
                          fontSize: 11,
                          fontWeight: isToday_ ? 800 : 500,
                          cursor: isFuture ? 'default' : 'pointer',
                          color:      isFuture   ? '#e2e8f0'
                                    : isSelected ? '#fff'
                                    : isToday_   ? color
                                    : '#334155',
                          background: isSelected ? color : 'transparent',
                          border:     isToday_ && !isSelected
                                        ? `1.5px solid ${color}`
                                        : '1.5px solid transparent',
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
              </div>
            </div>

            {/* MQTT box */}
            <div style={{
              background: '#f1f5f9', borderRadius: 12, padding: 14, border: '1.5px solid #e2e8f0',
              fontSize: 12, color: '#64748b',
            }}>
              <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>MQTT Data Source (future)</div>
              <code style={{ display: 'block', background: '#e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#1e293b', wordBreak: 'break-all' }}>
                application/&#123;appId&#125;/device/&#123;devEui&#125;/event/up
              </code>
              <div style={{ marginTop: 6 }}>Payload field: <code>object.distance</code></div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

const navBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 16, color: '#475569', padding: '0 6px', lineHeight: 1,
};
