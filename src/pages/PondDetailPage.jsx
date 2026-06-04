    import TankGauge from '../components/TankGauge';
    import StatusBadge from '../components/StatusBadge';
    import Sparkline from '../components/Sparkline';
    import { getStatusColor } from '../utils/waterLevel';

    // กล่องสถิติขนาดเล็ก — label / value / unit
    function Stat({ label, value, unit, color }) {
      return (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '14px 18px',
          border: '1.5px solid #e2e8f0', flex: 1, minWidth: 120,
        }}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color || '#1e293b' }}>
            {value}<span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>
          </div>
        </div>
      );
    }

    // หน้ารายละเอียดบ่อ — ถังใหญ่, สถิติ, กราฟ
    export default function PondDetailPage({ pondId, getPondState, updatePond, onBack, onOpenSettings }) {
      const state = getPondState(pondId);
      if (!state) return null; // ถ้าหาบ่อไม่เจอให้ render ว่าง

      const { pond, dist, waterHeight, pct, volume, status, history } = state;
      const color = getStatusColor(status);

      if (status === 'loading') return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 18, color: '#64748b', fontWeight: 600 }}>กำลังรอข้อมูลจาก Firebase...</div>
        </div>
      );

      return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 24 }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>

            {/* Header: ปุ่มย้อนกลับ + ชื่อบ่อ + badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <button onClick={onBack} style={{
                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 14,
              }}>
                ← Back
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{pond.name}</h2>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {pond.width} × {pond.length} × {pond.depth} cm
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={status} />
                {/* ปุ่มฟันเฟือง → เปิดหน้าตั้งค่า */}
                <button
                  onClick={onOpenSettings}
                  title="Settings"
                  style={{
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                    width: 38, height: 38, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748b',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  {/* SVG gear icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Layout หลัก: ถัง (ซ้าย) + คอลัมน์ข้อมูล (ขวา) */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

              {/* ถังน้ำขนาดใหญ่ */}
              <div style={{
                background: '#fff', borderRadius: 16, padding: 28,
                border: `2px solid ${color}44`, boxShadow: `0 4px 20px ${color}22`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                flex: '0 0 auto',
              }}>
                <TankGauge
                  pondWidth={pond.width}
                  pondDepth={pond.depth}
                  fillPercent={pct}
                  status={status}
                  id={`large-${pond.id}`}
                  size="large"
                />
                <StatusBadge status={status} />
              </div>

              {/* คอลัมน์ขวา */}
              <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* กล่องสถิติ 4 ช่อง */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Stat label="Water Height" value={Math.max(0, waterHeight).toFixed(1)} unit="cm" />
                  <Stat label="Water Level"  value={pct.toFixed(1)}                       unit="%" color={color} />
                  <Stat label="Volume"       value={Math.max(0, volume).toFixed(0)}        unit="L" />
                  <Stat label="Sensor Dist"  value={dist.toFixed(1)}                       unit="cm" />
                </div>

                {/* กราฟประวัติระดับน้ำ + ตารางรายละเอียด */}
                <div style={{
                  background: '#fff', borderRadius: 12, padding: 16, border: '1.5px solid #e2e8f0',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                    Level History (last {history.length} readings)
                  </div>

                  {/* แสดงกราฟเมื่อมีข้อมูลอย่างน้อย 2 จุด */}
                  {history.length >= 2 ? (
                    <Sparkline data={history} color={color} />
                  ) : (
                    <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                      Collecting data…
                    </div>
                  )}

                  {/* ตารางประวัติย้อนหลัง — เรียงล่าสุดก่อน */}
                  {history.length > 0 && (
                    <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '5px 8px', color: '#94a3b8', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>#</th>
                            <th style={{ padding: '5px 8px', color: '#94a3b8', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>เวลา</th>
                            <th style={{ padding: '5px 8px', color: '#94a3b8', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>ระดับน้ำ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...history].reverse().map((item, i) => {
                            const pct  = typeof item === 'number' ? item : item.pct;
                            const time = item.time ?? null;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '4px 8px', color: '#94a3b8' }}>{history.length - i}</td>
                                <td style={{ padding: '4px 8px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                                  {time ? new Date(time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                                  {pct.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* กล่องข้อมูล MQTT (แผนรองรับในอนาคต) */}
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
      