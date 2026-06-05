import { useState } from 'react';

function Field({ label, value, onChange, min, max, step, unit }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(typeof value === 'number' ? Number(e.target.value) : e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
            fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {unit && <span style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>{unit}</span>}
      </div>
    </label>
  );
}

// Input ความลึกพร้อม toggle หน่วย เมตร/ซม. — ค่าจริงเก็บเป็น ซม. เสมอ
function DepthField({ depthCm, onChangeCm }) {
  const [unit, setUnit] = useState('cm');
  const displayVal = unit === 'm' ? depthCm / 100 : depthCm;

  function handleChange(e) {
    const v = Number(e.target.value);
    onChangeCm(unit === 'm' ? Math.round(v * 100) : v);
  }

  const toggleStyle = (active) => ({
    padding: '4px 10px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: active ? '#3b82f6' : '#fff',
    color: active ? '#fff' : '#64748b',
  });

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>ความลึกบ่อ</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={displayVal}
          min={0.01}
          step={unit === 'm' ? 0.01 : 1}
          onChange={handleChange}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
            fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{
          display: 'flex', border: '1.5px solid #cbd5e1', borderRadius: 8,
          overflow: 'hidden', flexShrink: 0,
        }}>
          <button type="button" onClick={() => setUnit('cm')} style={toggleStyle(unit === 'cm')}>ซม.</button>
          <button type="button" onClick={() => setUnit('m')}  style={toggleStyle(unit === 'm')}>ม.</button>
        </div>
      </div>
    </label>
  );
}

export default function SettingsPanel({ pond, onUpdate }) {
  const [local, setLocal] = useState({ ...pond });
  const changed = JSON.stringify(local) !== JSON.stringify(pond);

  const set = (key) => (val) => setLocal(prev => ({ ...prev, [key]: val }));
  const apply = () => onUpdate(local);
  const reset = () => setLocal({ ...pond });

  // แสดง area เป็น ม² (input) → เก็บเป็น ซม² ใน local.area
  const areaM2 = +(local.area / 10000).toFixed(4);

  return (
    <div style={{
      background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b', fontWeight: 700 }}>Settings</h3>

      <Field label="Pond Name" value={local.name} onChange={set('name')} />

      {/* พื้นที่หน้าตัดบ่อ: ผู้ใช้กรอก ม², เก็บ ซม² */}
      <Field
        label="พื้นที่หน้าตัดบ่อ"
        value={areaM2}
        onChange={(v) => setLocal(prev => ({ ...prev, area: v * 10000 }))}
        min={0.01}
        step={0.01}
        unit="ม²"
      />

      {/* ความลึกบ่อ: toggle ซม./ม., เก็บ ซม. */}
      <DepthField
        depthCm={local.depth}
        onChangeCm={(v) => setLocal(prev => ({ ...prev, depth: v }))}
      />

      {/* ระยะห่างเซนเซอร์จากขอบบ่อ */}
      <Field
        label="ระยะห่างเซนเซอร์จากขอบบ่อ"
        value={local.sensorOffset}
        onChange={set('sensorOffset')}
        min={0}
        max={500}
        unit="ซม."
      />

      {/* Thresholds */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>Alert Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Yellow alert" value={local.thresholdYellow} onChange={set('thresholdYellow')} min={0} max={99} unit="%" />
          <Field label="Red alert"    value={local.thresholdRed}    onChange={set('thresholdRed')}    min={0} max={100} unit="%" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={apply}
          disabled={!changed}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: changed ? '#3b82f6' : '#94a3b8', color: '#fff',
            fontWeight: 600, fontSize: 14, cursor: changed ? 'pointer' : 'default',
          }}
        >Apply</button>
        <button
          onClick={reset}
          disabled={!changed}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 14,
            cursor: changed ? 'pointer' : 'default',
          }}
        >Reset</button>
      </div>
    </div>
  );
}
