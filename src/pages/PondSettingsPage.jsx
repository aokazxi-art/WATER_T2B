import SettingsPanel from '../components/SettingsPanel';

// หน้าตั้งค่าบ่อ — เปิดจากปุ่มฟันเฟืองใน PondDetailPage
export default function PondSettingsPage({ pond, onUpdate, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* Navbar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#64748b', padding: '4px 0',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          กลับ
        </button>
        <div style={{ width: 1, height: 18, background: '#e2e8f0' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Settings</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{pond.name}</div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>

        {/* แผงตั้งค่า */}
        <SettingsPanel pond={pond} onUpdate={onUpdate} />

      </div>
    </div>
  );
}
