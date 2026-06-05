import { useState, useRef, useEffect } from 'react';

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

// ใส่ลูกน้ำทุก 3 หลักในส่วนจำนวนเต็ม (รองรับทศนิยม)
function addCommas(m2) {
  const [intPart = '', decPart] = m2.toString().split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

// Input พื้นที่หน้าตัดบ่อ: type="text", format ลูกน้ำ realtime, เก็บ ซม² ภายใน
function AreaField({ areaCm2, onChangeCm2 }) {
  const inputRef = useRef(null);
  const [text, setText] = useState(() => addCommas(areaCm2 / 10000));

  // sync เมื่อ areaCm2 เปลี่ยนจากภายนอก (เช่น กด Reset)
  // tolerance 0.001 ม² ป้องกัน loop จากการพิมพ์เอง (เช่น "12." → parsed 12 → m2=12 → ไม่ reset)
  useEffect(() => {
    const m2 = areaCm2 / 10000;
    const currentNum = parseFloat(text.replace(/,/g, ''));
    if (isNaN(currentNum) || Math.abs(currentNum - m2) > 0.001) {
      setText(addCommas(m2));
    }
  }, [areaCm2]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e) {
    const el = e.target;
    const raw = el.value;
    const pos = el.selectionStart;

    // นับลูกน้ำก่อน cursor เพื่อ restore cursor หลัง reformat
    let commasBefore = 0;
    for (let i = 0; i < pos; i++) {
      if (raw[i] === ',') commasBefore++;
    }
    const digitPosBefore = pos - commasBefore;

    // กรองเฉพาะตัวเลขและจุดทศนิยม (จุดเดียว)
    const stripped = raw.replace(/[^\d.]/g, '');
    const dotIdx = stripped.indexOf('.');
    const sanitized = dotIdx === -1
      ? stripped
      : stripped.slice(0, dotIdx + 1) + stripped.slice(dotIdx + 1).replace(/\./g, '');

    // format integer part ด้วยลูกน้ำ
    const [intStr = '', decStr] = sanitized.split('.');
    const newText = decStr !== undefined
      ? `${intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decStr}`
      : intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    setText(newText);

    // อัปเดตค่า ซม²
    const num = parseFloat(sanitized);
    if (!isNaN(num) && num > 0) onChangeCm2(num * 10000);

    // คืน cursor position ให้ถูกต้องหลัง comma ถูกเพิ่ม/ลบ
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      let newPos;
      if (digitPosBefore === 0) {
        newPos = 0;
      } else {
        let seen = 0;
        newPos = newText.length; // fallback: ท้ายสุด
        for (let i = 0; i < newText.length; i++) {
          if (newText[i] !== ',') {
            seen++;
            if (seen === digitPosBefore) { newPos = i + 1; break; }
          }
        }
      }
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  }

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>พื้นที่หน้าตัดบ่อ</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={handleChange}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
            fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <span style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>ม²</span>
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

  return (
    <div style={{
      background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b', fontWeight: 700 }}>Settings</h3>

      <Field label="Pond Name" value={local.name} onChange={set('name')} />

      {/* พื้นที่หน้าตัดบ่อ: type=text, format ลูกน้ำ, เก็บ ซม² */}
      <AreaField
        areaCm2={local.area}
        onChangeCm2={(v) => setLocal(prev => ({ ...prev, area: v }))}
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
