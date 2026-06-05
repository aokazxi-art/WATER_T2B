import { useState, useEffect } from 'react';
import { firebaseConfig } from '../firebase';

const GATEWAYS_KEY = 'water_gateways';

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadGateways() {
  try {
    const s = localStorage.getItem(GATEWAYS_KEY);
    if (s) return JSON.parse(s);
  } catch (_) {}
  return [];
}

function persistGateways(gws) {
  localStorage.setItem(GATEWAYS_KEY, JSON.stringify(gws));
}

// ─── Utility ────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} day ago`;
}

function getSensorStatus(ts) {
  if (!ts) return 'no-data';
  const age = Date.now() - ts;
  if (age < 10 * 60_000) return 'online';
  if (age < 60 * 60_000) return 'stale';
  return 'offline';
}

const STATUS = {
  online:    { color: '#22c55e', label: 'Online',   bg: '#f0fdf4', border: '#86efac' },
  stale:     { color: '#f59e0b', label: 'Stale',    bg: '#fffbeb', border: '#fde68a' },
  offline:   { color: '#ef4444', label: 'Offline',  bg: '#fef2f2', border: '#fca5a5' },
  'no-data': { color: '#94a3b8', label: 'No Data',  bg: '#f8fafc', border: '#e2e8f0' },
};

// ─── Small components ───────────────────────────────────────────────────────

function BatteryIcon({ level }) {
  if (level == null) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  const pct = Math.max(0, Math.min(100, level));
  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';
  const fillW = Math.round((46 * pct) / 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="58" height="24" viewBox="0 0 58 24" fill="none">
        <rect x="1" y="2" width="52" height="20" rx="4" stroke={color} strokeWidth="2" fill="none" />
        <rect x="54" y="8" width="4" height="8" rx="1.5" fill={color} />
        <rect x="4" y="5" width={fillW} height="14" rx="2" fill={color} style={{ transition: 'width .4s' }} />
        {pct <= 20 && <text x="27" y="16" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="800">⚡</text>}
      </svg>
      <span style={{ fontSize: 12, color, fontWeight: 700, minWidth: 32 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatusBadge({ st }) {
  const s = STATUS[st];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>● {s.label}</span>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, marginTop: 24 }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#475569', flex: 1 }}>{children}</span>
      {action}
    </div>
  );
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: '#0ea5e9', color: '#fff', border: 'none',
      borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
      fontWeight: 600, fontSize: 12,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {label}
    </button>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="ลบ"
      style={{
        background: 'none', border: '1.5px solid #fca5a5', borderRadius: 8,
        padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1,
      }}
    >✕</button>
  );
}

// ─── Add forms ───────────────────────────────────────────────────────────────

function AddForm({ title, fields, onCancel, onSubmit, submitLabel }) {
  return (
    <div style={{
      background: '#f0f9ff', border: '1.5px dashed #38bdf8', borderRadius: 12,
      padding: 16, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>{title}</div>
      {fields}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0',
          background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>ยกเลิก</button>
        <button onClick={onSubmit} style={{
          padding: '6px 14px', borderRadius: 8, border: 'none',
          background: '#0ea5e9', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>{submitLabel}</button>
      </div>
    </div>
  );
}

function TextInput({ placeholder, value, onChange, mono }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
        fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
        fontFamily: mono ? 'monospace' : 'inherit', color: '#334155',
      }}
      onFocus={e => { e.target.style.borderColor = '#38bdf8'; }}
      onBlur={e => { e.target.style.borderColor = '#cbd5e1'; }}
    />
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function GatewayCard({ gateway, onRemove }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 8,
      border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{gateway.name}</div>
        {gateway.host && (
          <code style={{ fontSize: 11, color: '#64748b' }}>{gateway.host}</code>
        )}
      </div>
      <RemoveBtn onClick={onRemove} />
    </div>
  );
}

function SensorCard({ pond, meta, onRemove, updatePond }) {
  const st = getSensorStatus(meta?.timestamp);
  const stStyle = STATUS[st];
  const [draft, setDraft] = useState(pond.deviceId ?? '');
  const [savedOk, setSavedOk] = useState(false);

  // sync draft เมื่อ pond.deviceId เปลี่ยน (เช่น โหลดจาก Firebase)
  useEffect(() => { setDraft(pond.deviceId ?? ''); }, [pond.deviceId]);

  function handleSave() {
    updatePond(pond.id, { deviceId: draft.trim() });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 1500);
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 10,
      border: `1.5px solid ${stStyle.border}`,
    }}>
      {/* Row 1: name + status + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{pond.name}</span>
          <span style={{ marginLeft: 8 }}><StatusBadge st={st} /></span>
        </div>
        <RemoveBtn onClick={onRemove} />
      </div>

      {/* Row 2: last seen + battery */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Last Seen</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
            {meta?.timestamp ? timeAgo(meta.timestamp) : '—'}
          </div>
          {meta?.timestamp && (
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              {new Date(meta.timestamp).toLocaleString('th-TH')}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Battery</div>
          <BatteryIcon level={meta?.battery != null ? Math.round(meta.battery) : null} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Firebase Path</div>
          <code style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
            ponds/pond_{pond.id}/last_reading
          </code>
        </div>
      </div>

      {/* Row 3: Device EUI / ID */}
      <div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Device EUI / Sensor ID</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="เช่น AABBCCDDEEFF1122"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 12, fontFamily: 'monospace', color: '#334155', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#38bdf8'; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12,
              background: savedOk ? '#22c55e' : '#0ea5e9', color: '#fff',
              transition: 'background .2s', whiteSpace: 'nowrap',
            }}
          >{savedOk ? 'Saved ✓' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ConnectionPage({ ponds, sensorMeta, isConnected, onBack, addPond, removePond, updatePond }) {
  const [gateways, setGateways]     = useState(loadGateways);
  const [addingGW, setAddingGW]     = useState(false);
  const [addingSensor, setAddingSensor] = useState(false);
  const [newGW, setNewGW]           = useState({ name: '', host: '' });
  const [newSensor, setNewSensor]   = useState({ name: '', deviceId: '' });

  // tick ทุก 10s เพื่อ update timeAgo (ส่งผ่าน key บังคับ re-render)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  function handleAddGateway() {
    if (!newGW.name.trim()) return;
    const nextId = Math.max(0, ...gateways.map(g => g.id), 0) + 1;
    const updated = [...gateways, { id: nextId, name: newGW.name.trim(), host: newGW.host.trim() }];
    setGateways(updated);
    persistGateways(updated);
    setNewGW({ name: '', host: '' });
    setAddingGW(false);
  }

  function handleRemoveGateway(id) {
    const updated = gateways.filter(g => g.id !== id);
    setGateways(updated);
    persistGateways(updated);
  }

  function handleAddSensor() {
    if (!newSensor.name.trim()) return;
    addPond(newSensor.name.trim(), newSensor.deviceId.trim());
    setNewSensor({ name: '', deviceId: '' });
    setAddingSensor(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 24 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={onBack} style={{
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
            padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 14,
          }}>← Back</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Device Connections</h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Firebase · Gateways · Sensors</div>
          </div>
        </div>

        {/* Firebase connection */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20, marginBottom: 8,
          border: isConnected ? '2px solid #86efac' : '2px solid #fca5a5',
          boxShadow: '0 2px 12px #0001',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#ef4444',
              boxShadow: `0 0 8px ${isConnected ? '#22c55e' : '#ef4444'}`,
            }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', flex: 1 }}>Firebase Realtime Database</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: isConnected ? '#f0fdf4' : '#fef2f2',
              color: isConnected ? '#22c55e' : '#ef4444',
              border: `1px solid ${isConnected ? '#86efac' : '#fca5a5'}`,
            }}>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#64748b' }}>
            <div><span style={{ color: '#94a3b8' }}>Project: </span><code style={{ color: '#334155' }}>{firebaseConfig.projectId}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Database: </span><code style={{ color: '#334155', wordBreak: 'break-all' }}>{firebaseConfig.databaseURL}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Region: </span><code style={{ color: '#334155' }}>asia-southeast1</code></div>
          </div>
        </div>

        {/* ─── Gateways ─────────────────────────────────────────────────────── */}
        <SectionTitle action={<AddBtn onClick={() => { setAddingGW(true); setAddingSensor(false); }} label="เพิ่ม Gateway" />}>
          Gateways
        </SectionTitle>

        {addingGW && (
          <AddForm
            title="เพิ่ม Gateway ใหม่"
            onCancel={() => setAddingGW(false)}
            onSubmit={handleAddGateway}
            submitLabel="เพิ่ม Gateway"
            fields={
              <>
                <TextInput placeholder="ชื่อ Gateway เช่น GW-Building-A" value={newGW.name} onChange={v => setNewGW(p => ({ ...p, name: v }))} />
                <TextInput placeholder="Host / IP (ไม่บังคับ) เช่น 192.168.1.1" value={newGW.host} onChange={v => setNewGW(p => ({ ...p, host: v }))} mono />
              </>
            }
          />
        )}

        {gateways.length === 0 && !addingGW && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: '20px', marginBottom: 8,
            border: '1.5px dashed #e2e8f0', textAlign: 'center',
            fontSize: 13, color: '#94a3b8',
          }}>ยังไม่มี Gateway — กด <strong>เพิ่ม Gateway</strong> เพื่อเพิ่ม</div>
        )}

        {gateways.map(gw => (
          <GatewayCard key={gw.id} gateway={gw} onRemove={() => handleRemoveGateway(gw.id)} />
        ))}

        {/* ─── Sensors & Ponds ───────────────────────────────────────────────── */}
        <SectionTitle action={<AddBtn onClick={() => { setAddingSensor(true); setAddingGW(false); }} label="เพิ่ม Sensor" />}>
          Sensors &amp; Ponds
        </SectionTitle>

        {addingSensor && (
          <AddForm
            title="เพิ่ม Sensor + Pond ใหม่"
            onCancel={() => setAddingSensor(false)}
            onSubmit={handleAddSensor}
            submitLabel="เพิ่ม Sensor"
            fields={
              <>
                <TextInput placeholder="ชื่อ เช่น บ่อเลี้ยงกุ้ง 1 หรือ Pond E" value={newSensor.name} onChange={v => setNewSensor(p => ({ ...p, name: v }))} />
                <TextInput placeholder="Device EUI / Sensor ID (ไม่บังคับ) เช่น AABBCCDDEEFF1122" value={newSensor.deviceId} onChange={v => setNewSensor(p => ({ ...p, deviceId: v }))} mono />
                <div style={{ fontSize: 11, color: '#0369a1', background: '#e0f2fe', borderRadius: 6, padding: '6px 10px' }}>
                  บ่อใหม่จะถูกสร้างอัตโนมัติ — ตั้งค่า Depth / Area ได้ในหน้า Settings ของบ่อ
                </div>
              </>
            }
          />
        )}

        {ponds.length === 0 && !addingSensor && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: '20px', marginBottom: 8,
            border: '1.5px dashed #e2e8f0', textAlign: 'center',
            fontSize: 13, color: '#94a3b8',
          }}>ยังไม่มี Sensor — กด <strong>เพิ่ม Sensor</strong> เพื่อเพิ่ม</div>
        )}

        {ponds.map(pond => (
          <SensorCard
            key={`${pond.id}-${tick}`}
            pond={pond}
            meta={sensorMeta[pond.id]}
            onRemove={() => removePond(pond.id)}
            updatePond={updatePond}
          />
        ))}

      </div>
    </div>
  );
}
