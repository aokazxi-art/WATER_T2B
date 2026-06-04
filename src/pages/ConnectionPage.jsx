import { useState, useEffect } from 'react';
import { firebaseConfig } from '../firebase';

const DEVICE_IDS_KEY = 'water_monitor_device_ids';

function loadDeviceIds() {
  try {
    const saved = localStorage.getItem(DEVICE_IDS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return {};
}

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
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
  if (age < 10 * 60 * 1000) return 'online';
  if (age < 60 * 60 * 1000) return 'stale';
  return 'offline';
}

const STATUS_STYLE = {
  online:  { color: '#22c55e', label: 'Online',   bg: '#f0fdf4', border: '#86efac' },
  stale:   { color: '#f59e0b', label: 'Stale',    bg: '#fffbeb', border: '#fde68a' },
  offline: { color: '#ef4444', label: 'Offline',  bg: '#fef2f2', border: '#fca5a5' },
  'no-data': { color: '#94a3b8', label: 'No Data', bg: '#f8fafc', border: '#e2e8f0' },
};

function BatteryIcon({ level }) {
  if (level == null) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  const pct = Math.max(0, Math.min(100, level));
  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';

  // battery body: 52×24, nub: 4×10, inner fill area: 46×18 (offset 3,3)
  const fillW = Math.round((46 * pct) / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="58" height="24" viewBox="0 0 58 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* body */}
        <rect x="1" y="2" width="52" height="20" rx="4" ry="4"
          stroke={color} strokeWidth="2" fill="none" />
        {/* terminal cap */}
        <rect x="54" y="8" width="4" height="8" rx="1.5" fill={color} />
        {/* fill */}
        <rect x="4" y="5" width={fillW} height="14" rx="2" fill={color} style={{ transition: 'width .4s, fill .4s' }} />
        {/* low-battery lightning bolt when ≤ 20% */}
        {pct <= 20 && (
          <text x="27" y="16" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="800">⚡</text>
        )}
      </svg>
      <span style={{ fontSize: 13, color, fontWeight: 700, minWidth: 36 }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function ConnectionPage({ ponds, sensorMeta, isConnected, onBack }) {
  const [deviceIds, setDeviceIds] = useState(loadDeviceIds);
  const [drafts, setDrafts] = useState({});
  const [saved, setSaved] = useState({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  function handleSaveDeviceId(pondId) {
    const val = (drafts[pondId] ?? deviceIds[pondId] ?? '').trim();
    const next = { ...deviceIds, [pondId]: val };
    setDeviceIds(next);
    localStorage.setItem(DEVICE_IDS_KEY, JSON.stringify(next));
    setSaved(prev => ({ ...prev, [pondId]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [pondId]: false })), 1500);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 24 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={onBack} style={{
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
            padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 14,
          }}>
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Device Connections</h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Gateway · Sensors · Device IDs</div>
          </div>
        </div>

        {/* Firebase Gateway Card */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24,
          border: isConnected ? '2px solid #86efac' : '2px solid #fca5a5',
          boxShadow: '0 2px 12px #0001',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#ef4444',
              boxShadow: `0 0 8px ${isConnected ? '#22c55e' : '#ef4444'}`,
            }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
              Firebase Gateway
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: isConnected ? '#f0fdf4' : '#fef2f2',
              color: isConnected ? '#22c55e' : '#ef4444',
              border: `1px solid ${isConnected ? '#86efac' : '#fca5a5'}`,
            }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#64748b' }}>
            <div><span style={{ color: '#94a3b8' }}>Project: </span><code style={{ color: '#334155' }}>{firebaseConfig.projectId}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Database: </span><code style={{ color: '#334155', wordBreak: 'break-all' }}>{firebaseConfig.databaseURL}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Region: </span><code style={{ color: '#334155' }}>asia-southeast1</code></div>
          </div>
        </div>

        {/* Sensor Status List */}
        <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 12 }}>Sensor Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {ponds.map(pond => {
            const meta = sensorMeta[pond.id];
            const st = getSensorStatus(meta?.timestamp);
            const style = STATUS_STYLE[st];

            return (
              <div key={pond.id} style={{
                background: '#fff', borderRadius: 14, padding: '16px 20px',
                border: `1.5px solid ${style.border}`,
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16,
              }}>
                {/* ชื่อบ่อ + status */}
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{pond.name}</div>
                  <span style={{
                    display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 12,
                    background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                  }}>
                    ● {style.label}
                  </span>
                </div>

                {/* Last seen */}
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Last Seen</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    {meta?.timestamp ? timeAgo(meta.timestamp) : '—'}
                  </div>
                  {meta?.timestamp && (
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                      {new Date(meta.timestamp).toLocaleString('th-TH')}
                    </div>
                  )}
                </div>

                {/* Battery */}
                <div style={{ minWidth: 90 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Battery</div>
                  <BatteryIcon level={meta?.battery != null ? Math.round(meta.battery) : null} />
                </div>

                {/* Firebase Path */}
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Firebase Path</div>
                  <code style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                    ponds/pond_{pond.id}/last_reading
                  </code>
                </div>
              </div>
            );
          })}
        </div>

        {/* Device ID Configuration */}
        <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 12 }}>
          Sensor Device ID Mapping
          <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
            (LoRa / MQTT Device EUI หรือ Sensor ID)
          </span>
        </div>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20,
          border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {ponds.map(pond => (
            <div key={pond.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 80, fontWeight: 600, fontSize: 14, color: '#334155' }}>{pond.name}</div>
              <input
                type="text"
                placeholder={`Device ID / EUI สำหรับ ${pond.name}`}
                value={drafts[pond.id] ?? deviceIds[pond.id] ?? ''}
                onChange={e => setDrafts(prev => ({ ...prev, [pond.id]: e.target.value }))}
                style={{
                  flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 13,
                  border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none',
                  fontFamily: 'monospace', color: '#334155',
                }}
                onFocus={e => { e.target.style.borderColor = '#38bdf8'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
              />
              <button
                onClick={() => handleSaveDeviceId(pond.id)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: 13,
                  background: saved[pond.id] ? '#22c55e' : '#0ea5e9',
                  color: '#fff', transition: 'background .2s',
                }}
              >
                {saved[pond.id] ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
