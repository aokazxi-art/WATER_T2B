import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { loadDailyHistory } from '../hooks/usePondData';

const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                   'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDaysWithData(pondId, year, month) {
  const days = new Set();
  for (let d = 1; d <= 31; d++) {
    const key = `water_daily_${pondId}_${toDateKey(year, month, d)}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw && raw !== '[]') days.add(d);
    } catch (_) {}
  }
  return days;
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function DailyChart({ pondId, pondName, color, onClose }) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayData, setDayData] = useState([]);

  const daysWithData = useMemo(
    () => getDaysWithData(pondId, viewYear, viewMonth),
    [pondId, viewYear, viewMonth, dayData] // re-check เมื่อ dayData เปลี่ยน
  );

  useEffect(() => {
    setDayData(loadDailyHistory(pondId, selectedDate));
  }, [pondId, selectedDate]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const n = new Date(viewYear, viewMonth + 1, 1);
    if (n <= today) {
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

  const chartData = dayData.map(item => ({ time: item.time, v: item.pct }));
  const avg = dayData.length ? (dayData.reduce((s, x) => s + x.pct, 0) / dayData.length).toFixed(1) : null;
  const min = dayData.length ? Math.min(...dayData.map(x => x.pct)).toFixed(1) : null;
  const max = dayData.length ? Math.max(...dayData.map(x => x.pct)).toFixed(1) : null;

  const selDay   = selectedDate.getDate();
  const selMonth = selectedDate.getMonth();
  const selYear  = selectedDate.getFullYear();
  const selLabel = `${selDay} ${MONTHS_TH[selMonth]} ${selYear + 543}`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20,
          width: '100%', maxWidth: 780,
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
              {pondName} — ประวัติรายวัน
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {selLabel} · {dayData.length} readings
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: '#f1f5f9', border: 'none',
              borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
              fontSize: 15, color: '#64748b',
            }}
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap' }}>

          {/* ===== ปฏิทิน ===== */}
          <div style={{
            width: 260, flexShrink: 0, padding: '16px 20px',
            borderRight: '1px solid #f1f5f9',
          }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <button onClick={prevMonth} style={navBtn}>‹</button>
              <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                {MONTHS_TH[viewMonth]} {viewYear + 543}
              </span>
              <button onClick={nextMonth} disabled={isNextDisabled} style={{
                ...navBtn,
                color: isNextDisabled ? '#cbd5e1' : '#475569',
                cursor: isNextDisabled ? 'default' : 'pointer',
              }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {DAYS_TH.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '2px 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;

                const cellDate  = new Date(viewYear, viewMonth, day);
                const isFuture  = cellDate > today;
                const isToday_  = cellDate.toDateString() === today.toDateString();
                const isSelected = (
                  day === selDay &&
                  viewMonth === selMonth &&
                  viewYear === selYear
                );
                const hasData   = daysWithData.has(day);

                return (
                  <div
                    key={day}
                    onClick={() => !isFuture && selectDay(day)}
                    style={{
                      position: 'relative',
                      textAlign: 'center',
                      padding: '5px 0',
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: isToday_ ? 800 : 500,
                      cursor: isFuture ? 'default' : 'pointer',
                      color: isFuture ? '#e2e8f0'
                           : isSelected ? '#fff'
                           : isToday_ ? color
                           : '#334155',
                      background: isSelected ? color : 'transparent',
                      border: isToday_ && !isSelected ? `1.5px solid ${color}` : '1.5px solid transparent',
                      transition: 'background .15s',
                    }}
                  >
                    {day}
                    {/* จุดแสดงว่ามีข้อมูล */}
                    {hasData && !isSelected && (
                      <div style={{
                        position: 'absolute', bottom: 2, left: '50%',
                        transform: 'translateX(-50%)',
                        width: 4, height: 4, borderRadius: '50%',
                        background: color, opacity: 0.7,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 14, fontSize: 11, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                มีข้อมูล
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: color, opacity: 0.9 }} />
                วันที่เลือก
              </div>
            </div>
          </div>

          {/* ===== กราฟ + สถิติ ===== */}
          <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>

            {/* Stats */}
            {dayData.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'เฉลี่ย', value: avg, c: color },
                    { label: 'ต่ำสุด', value: min, c: '#22c55e' },
                    { label: 'สูงสุด', value: max, c: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, background: '#f8fafc', borderRadius: 10,
                      padding: '8px 12px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.value}%</div>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={fmtTime}
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      tickCount={6}
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
                      type="monotone" dataKey="v"
                      stroke={color} fill={color}
                      fillOpacity={0.15} strokeWidth={2.5}
                      dot={false} isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{
                height: 260, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#94a3b8', fontSize: 13,
                background: '#f8fafc', borderRadius: 12,
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                ไม่มีข้อมูลสำหรับวันที่เลือก
                <div style={{ fontSize: 11, marginTop: 4, color: '#cbd5e1' }}>
                  วันที่มีจุด ● มีข้อมูลให้ดู
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const navBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 18, color: '#475569', padding: '0 6px', lineHeight: 1,
};
