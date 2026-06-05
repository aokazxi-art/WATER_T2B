import { useState, useEffect } from 'react';
import { firebaseConfig } from '../firebase';

const GATEWAYS_KEY = 'water_gateways';

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
  online:    { color: '#22c55e', label: 'Online',  bg: '#f0fdf4', border: '#86efac' },
  stale:     { color: '#f59e0b', label: 'Stale',   bg: '#fffbeb', border: '#fde68a' },
  offline:   { color: '#ef4444', label: 'Offline', bg: '#fef2f2', border: '#fca5a5' },
  'no-data': { color: '#94a3b8', label: 'No Data', bg: '#f8fafc', border: '#e2e8f0' },
};

// ─── Atom components ─────────────────────────────────────────────────────────

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
      borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {label}
    </button>
  );
}

function IconBtn({ onClick, title, icon, color = '#ef4444', borderColor = '#fca5a5' }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: `1.5px solid ${borderColor}`, borderRadius: 8,
      padding: '4px 8px', cursor: 'pointer', color, fontSize: 13, lineHeight: 1,
    }}>{icon}</button>
  );
}

function TextInput({ placeholder, value, onChange, mono, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</span>}
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
    </div>
  );
}

function GatewaySelect({ gateways, value, onChange, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</span>}
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        style={{
          padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
          fontSize: 13, outline: 'none', background: '#fff', color: '#334155',
          cursor: 'pointer', width: '100%', boxSizing: 'border-box',
        }}
      >
        <option value="">— ไม่ระบุ Gateway —</option>
        {gateways.map(gw => (
          <option key={gw.id} value={gw.id}>{gw.name}{gw.host ? ` (${gw.host})` : ''}</option>
        ))}
      </select>
    </div>
  );
}

function FormFooter({ onCancel, onSubmit, submitLabel }) {
  return (
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
  );
}

// ─── Gateway card ─────────────────────────────────────────────────────────────

function GatewayCard({ gateway, onRemove, onUpdate }) {
  const [editing,       setEditing]       = useState(false);
  const [draftName,     setDraftName]     = useState(gateway.name);
  const [draftHost,     setDraftHost]     = useState(gateway.host ?? '');
  const [draftAppId,    setDraftAppId]    = useState(gateway.appId ?? '');
  const [draftMqttPort, setDraftMqttPort] = useState(String(gateway.mqttPort ?? 1883));

  function handleSave() {
    if (!draftName.trim()) return;
    onUpdate({
      ...gateway,
      name: draftName.trim(), host: draftHost.trim(),
      appId: draftAppId.trim(), mqttPort: Number(draftMqttPort) || 1883,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{
        background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12,
        padding: 14, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <TextInput label="ชื่อ Gateway" placeholder="เช่น GW-Building-A" value={draftName} onChange={setDraftName} />
        <TextInput label="Host / IP ของ ChirpStack" placeholder="เช่น 192.168.1.100" value={draftHost} onChange={setDraftHost} mono />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
          <TextInput label="ChirpStack App ID" placeholder="เช่น 1 หรือ abc-uuid" value={draftAppId} onChange={setDraftAppId} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>MQTT Port</span>
            <input
              type="number"
              value={draftMqttPort}
              onChange={e => setDraftMqttPort(e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
                fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>
        </div>
        <FormFooter
          onCancel={() => {
            setDraftName(gateway.name); setDraftHost(gateway.host ?? '');
            setDraftAppId(gateway.appId ?? ''); setDraftMqttPort(String(gateway.mqttPort ?? 1883));
            setEditing(false);
          }}
          onSubmit={handleSave}
          submitLabel="บันทึก"
        />
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 8,
      border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{gateway.name}</span>
        {gateway.host && (
          <code style={{ marginLeft: 10, fontSize: 11, color: '#64748b' }}>
            {gateway.host}:{gateway.mqttPort ?? 1883}
          </code>
        )}
        {gateway.appId && (
          <span style={{
            marginLeft: 8, fontSize: 11, color: '#0369a1',
            background: '#e0f2fe', padding: '1px 7px', borderRadius: 6,
          }}>App: {gateway.appId}</span>
        )}
      </div>
      <IconBtn onClick={() => setEditing(true)} title="แก้ไขชื่อ" icon="✎" color="#0ea5e9" borderColor="#bae6fd" />
      <IconBtn onClick={onRemove} title="ลบ" icon="✕" color="#ef4444" borderColor="#fca5a5" />
    </div>
  );
}

// ─── Sensor card ──────────────────────────────────────────────────────────────

function SensorCard({ pond, meta, gateways, onRemove, updatePond }) {
  const st = getSensorStatus(meta?.timestamp);
  const stStyle = STATUS[st];

  const [draftEUI, setDraftEUI]   = useState(pond.deviceId ?? '');
  const [euiSaved, setEuiSaved]   = useState(false);

  useEffect(() => { setDraftEUI(pond.deviceId ?? ''); }, [pond.deviceId]);

  function handleSaveEUI() {
    updatePond(pond.id, { deviceId: draftEUI.trim() });
    setEuiSaved(true);
    setTimeout(() => setEuiSaved(false), 1500);
  }

  function handleGatewayChange(gwId) {
    updatePond(pond.id, { gatewayId: gwId });
  }

  const linkedGW = gateways.find(g => g.id === pond.gatewayId);

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
          {linkedGW && (
            <span style={{
              marginLeft: 8, fontSize: 11, color: '#64748b',
              background: '#f1f5f9', padding: '1px 7px', borderRadius: 8,
            }}>via {linkedGW.name}</span>
          )}
        </div>
        <IconBtn onClick={onRemove} title="ลบ sensor และบ่อ" icon="✕" color="#ef4444" borderColor="#fca5a5" />
      </div>

      {/* Row 2: last seen + battery + path */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Last Seen</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
            {meta?.timestamp ? timeAgo(meta.timestamp) : '—'}
          </div>
          {meta?.timestamp && (
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(meta.timestamp).toLocaleString('th-TH')}</div>
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

      {/* Row 3: Gateway selector */}
      <div style={{ marginBottom: 10 }}>
        <GatewaySelect
          label="เชื่อมต่อผ่าน Gateway"
          gateways={gateways}
          value={pond.gatewayId}
          onChange={handleGatewayChange}
        />
      </div>

      {/* Row 4: Device EUI */}
      <div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Device EUI / Sensor ID</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="เช่น AABBCCDDEEFF1122"
            value={draftEUI}
            onChange={e => setDraftEUI(e.target.value)}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 12, fontFamily: 'monospace', color: '#334155', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#38bdf8'; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
          />
          <button
            onClick={handleSaveEUI}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', transition: 'background .2s',
              background: euiSaved ? '#22c55e' : '#0ea5e9', color: '#fff',
            }}
          >{euiSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </div>

      {/* Row 5: Sensor Model */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Sensor Model</div>
        <select
          value={pond.sensorModel ?? ''}
          onChange={e => updatePond(pond.id, { sensorModel: e.target.value })}
          style={{
            padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            fontSize: 12, background: '#fff', color: '#334155', outline: 'none',
            width: '100%', boxSizing: 'border-box', cursor: 'pointer',
          }}
        >
          <option value="">Generic / Other</option>
          <option value="milesight-em500-udl">Milesight EM500-UDL</option>
        </select>
        {pond.sensorModel === 'milesight-em500-udl' && (
          <div style={{
            marginTop: 6, fontSize: 11, color: '#0369a1',
            background: '#e0f2fe', borderRadius: 6, padding: '6px 10px',
            fontFamily: 'monospace', lineHeight: 1.8,
          }}>
            FF 0B &lt;battery%&gt; | 01 82 &lt;dist_mm uint16LE&gt;<br />
            เช่น: <strong>01 4C 02</strong> → 588 mm → 58.8 cm
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add forms ────────────────────────────────────────────────────────────────

function AddGatewayForm({ onCancel, onSubmit }) {
  const [name,     setName]     = useState('');
  const [host,     setHost]     = useState('');
  const [appId,    setAppId]    = useState('');
  const [mqttPort, setMqttPort] = useState('1883');
  return (
    <div style={{
      background: '#f0f9ff', border: '1.5px dashed #38bdf8', borderRadius: 12,
      padding: 16, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>เพิ่ม Gateway ใหม่</div>
      <TextInput label="ชื่อ Gateway" placeholder="เช่น GW-Building-A" value={name} onChange={setName} />
      <TextInput label="Host / IP ของ ChirpStack" placeholder="เช่น 192.168.1.100" value={host} onChange={setHost} mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
        <TextInput label="ChirpStack App ID" placeholder="เช่น 1 หรือ abc-uuid" value={appId} onChange={setAppId} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>MQTT Port</span>
          <input
            type="number"
            value={mqttPort}
            onChange={e => setMqttPort(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1',
              fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
            }}
          />
        </div>
      </div>
      <FormFooter
        onCancel={onCancel}
        onSubmit={() => onSubmit(name, host, appId, Number(mqttPort) || 1883)}
        submitLabel="เพิ่ม Gateway"
      />
    </div>
  );
}

function AddSensorForm({ gateways, onCancel, onSubmit }) {
  const [name, setName]         = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [gatewayId, setGatewayId] = useState(null);
  return (
    <div style={{
      background: '#f0f9ff', border: '1.5px dashed #38bdf8', borderRadius: 12,
      padding: 16, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>เพิ่ม Sensor + Pond ใหม่</div>
      <TextInput label="ชื่อบ่อ / Sensor" placeholder="เช่น บ่อเลี้ยงกุ้ง 1 หรือ Pond E" value={name} onChange={setName} />
      <TextInput label="Device EUI / Sensor ID (ไม่บังคับ)" placeholder="เช่น AABBCCDDEEFF1122" value={deviceId} onChange={setDeviceId} mono />
      {gateways.length > 0 && (
        <GatewaySelect label="เชื่อมต่อผ่าน Gateway (ไม่บังคับ)" gateways={gateways} value={gatewayId} onChange={setGatewayId} />
      )}
      <div style={{ fontSize: 11, color: '#0369a1', background: '#e0f2fe', borderRadius: 6, padding: '6px 10px' }}>
        บ่อใหม่จะถูกสร้างอัตโนมัติ — ตั้งค่า Depth / Area ได้ในหน้า Settings ของบ่อ
      </div>
      <FormFooter onCancel={onCancel} onSubmit={() => onSubmit(name, deviceId, gatewayId)} submitLabel="เพิ่ม Sensor" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConnectionPage({ ponds, sensorMeta, isConnected, onBack, addPond, removePond, updatePond }) {
  const [gateways, setGateways]         = useState(loadGateways);
  const [addingGW, setAddingGW]         = useState(false);
  const [addingSensor, setAddingSensor] = useState(false);
  const [tick, setTick]                 = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  function saveGateways(updated) {
    setGateways(updated);
    persistGateways(updated);
  }

  function handleAddGateway(name, host, appId, mqttPort) {
    if (!name.trim()) return;
    const nextId = Math.max(0, ...gateways.map(g => g.id), 0) + 1;
    saveGateways([...gateways, {
      id: nextId, name: name.trim(), host: host.trim(),
      appId: (appId ?? '').trim(), mqttPort: mqttPort || 1883,
    }]);
    setAddingGW(false);
  }

  function handleUpdateGateway(updated) {
    saveGateways(gateways.map(g => g.id === updated.id ? updated : g));
  }

  function handleRemoveGateway(id) {
    saveGateways(gateways.filter(g => g.id !== id));
    // reset gatewayId ของ sensor ที่อ้างถึง gateway นี้
    ponds.forEach(p => { if (p.gatewayId === id) updatePond(p.id, { gatewayId: null }); });
  }

  function handleAddSensor(name, deviceId, gatewayId) {
    if (!name.trim()) return;
    addPond(name.trim(), deviceId.trim(), gatewayId);
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

        {/* ─── Gateways ── */}
        <SectionTitle action={<AddBtn onClick={() => { setAddingGW(true); setAddingSensor(false); }} label="เพิ่ม Gateway" />}>
          Gateways
        </SectionTitle>

        {addingGW && <AddGatewayForm onCancel={() => setAddingGW(false)} onSubmit={handleAddGateway} />}

        {gateways.length === 0 && !addingGW && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20, marginBottom: 8,
            border: '1.5px dashed #e2e8f0', textAlign: 'center', fontSize: 13, color: '#94a3b8',
          }}>ยังไม่มี Gateway — กด <strong>เพิ่ม Gateway</strong> เพื่อเพิ่ม</div>
        )}

        {gateways.map(gw => (
          <GatewayCard
            key={gw.id}
            gateway={gw}
            onUpdate={handleUpdateGateway}
            onRemove={() => handleRemoveGateway(gw.id)}
          />
        ))}

        {/* ─── Sensors & Ponds ── */}
        <SectionTitle action={<AddBtn onClick={() => { setAddingSensor(true); setAddingGW(false); }} label="เพิ่ม Sensor" />}>
          Sensors &amp; Ponds
        </SectionTitle>

        {addingSensor && (
          <AddSensorForm
            gateways={gateways}
            onCancel={() => setAddingSensor(false)}
            onSubmit={handleAddSensor}
          />
        )}

        {ponds.length === 0 && !addingSensor && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20, marginBottom: 8,
            border: '1.5px dashed #e2e8f0', textAlign: 'center', fontSize: 13, color: '#94a3b8',
          }}>ยังไม่มี Sensor — กด <strong>เพิ่ม Sensor</strong> เพื่อเพิ่ม</div>
        )}

        {ponds.map(pond => (
          <SensorCard
            key={`${pond.id}-${tick}`}
            pond={pond}
            meta={sensorMeta[pond.id]}
            gateways={gateways}
            onRemove={() => removePond(pond.id)}
            updatePond={updatePond}
          />
        ))}

      </div>
    </div>
  );
}
