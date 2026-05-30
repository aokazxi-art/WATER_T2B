import TankGauge from '../components/TankGauge';
import StatusBadge from '../components/StatusBadge';
import Sparkline from '../components/Sparkline';
import SettingsPanel from '../components/SettingsPanel';
import { getStatusColor } from '../utils/waterLevel';

const SENSOR_OFFSET = 30; // ระยะออฟเซ็ตของเซ็นเซอร์เหนือขอบบ่อ (ซม.)

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

// หน้ารายละเอียดบ่อ — ถังใหญ่, สถิติ, slider จำลอง, กราฟ, ตั้งค่า
export default function PondDetailPage({ pondId, getPondState, updatePond, setSensorDistance, onBack }) {
  const state = getPondState(pondId);
  if (!state) return null; // ถ้าหาบ่อไม่เจอให้ render ว่าง

  const { pond, dist, waterHeight, pct, volume, status, history } = state;
  const color = getStatusColor(status);

  // ขอบเขตของ slider เซ็นเซอร์ (min = น้ำเต็ม, max = น้ำว่าง)
  const minDist = SENSOR_OFFSET;
  const maxDist = pond.depth + SENSOR_OFFSET;

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
          <div style={{ marginLeft: 'auto' }}>
            <StatusBadge status={status} />
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

            {/* Slider จำลองระยะเซ็นเซอร์ด้วยมือ */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: 16, border: '1.5px solid #e2e8f0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
                Simulate Sensor Distance
              </div>
              <input
                type="range"
                min={minDist}
                max={maxDist}
                step={0.5}
                value={dist}
                onChange={e => setSensorDistance(pond.id, Number(e.target.value))}
                style={{ width: '100%', accentColor: color }}
              />
              {/* คำอธิบายขอบเขต slider */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                <span>{minDist} cm (100% full)</span>
                <span>{maxDist} cm (0% full)</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Current sensor reading: <strong>{dist.toFixed(1)} cm</strong>
              </div>
            </div>

            {/* กราฟประวัติระดับน้ำ */}
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

        {/* แผงตั้งค่าบ่อ */}
        <div style={{ marginTop: 24 }}>
          <SettingsPanel pond={pond} onUpdate={(updates) => updatePond(pond.id, updates)} />
        </div>
      </div>
    </div>
  );
}
  