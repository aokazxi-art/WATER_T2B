import { useState } from 'react';

// input field พร้อม label และหน่วย (ใช้ซ้ำภายใน SettingsPanel)
function Field({ label, value, onChange, min, max, unit }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          value={value}
          min={min}
          max={max}
          // แปลงกลับเป็น number ถ้า value เดิมเป็น number
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

// แผงตั้งค่าบ่อ — แก้ชื่อ, ขนาด, threshold แจ้งเตือน
export default function SettingsPanel({ pond, onUpdate }) {
  // สำเนาข้อมูลบ่อในเครื่อง ก่อน apply
  const [local, setLocal] = useState({ ...pond });

  // เปรียบเทียบว่ามีการแก้ไขหรือยัง
  const changed = JSON.stringify(local) !== JSON.stringify(pond);

  // helper สร้าง setter สำหรับแต่ละ key
  const set = (key) => (val) => setLocal(prev => ({ ...prev, [key]: val }));

  // บันทึกการเปลี่ยนแปลงไปยัง state หลัก
  const apply = () => onUpdate(local);

  // ยกเลิกการเปลี่ยนแปลง คืนค่าเดิม
  const reset = () => setLocal({ ...pond });

  return (
    <div style={{
      background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b', fontWeight: 700 }}>Settings</h3>

      {/* ชื่อบ่อ */}
      <Field label="Pond Name" value={local.name} onChange={set('name')} />

      {/* ขนาดบ่อ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Depth"  value={local.depth}  onChange={set('depth')}  min={10} max={1000} unit="cm" />
        <Field label="Width"  value={local.width}  onChange={set('width')}  min={10} max={5000} unit="cm" />
        <Field label="Length" value={local.length} onChange={set('length')} min={10} max={5000} unit="cm" />
      </div>

      {/* ค่า threshold แจ้งเตือน */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>Alert Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Yellow alert" value={local.thresholdYellow} onChange={set('thresholdYellow')} min={0} max={99} unit="%" />
          <Field label="Red alert"    value={local.thresholdRed}    onChange={set('thresholdRed')}    min={0} max={100} unit="%" />
        </div>
      </div>

      {/* ปุ่ม Apply / Reset — disable เมื่อยังไม่มีการเปลี่ยนแปลง */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={apply}
          disabled={!changed}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: changed ? '#3b82f6' : '#94a3b8', color: '#fff',
            fontWeight: 600, fontSize: 14, cursor: changed ? 'pointer' : 'default',
          }}
        >
          Apply
        </button>
        <button
          onClick={reset}
          disabled={!changed}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 14,
            cursor: changed ? 'pointer' : 'default',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
