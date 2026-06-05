import PondCard from '../components/PondCard';

export default function HomePage({ ponds, getPondState, isConnected, onSelectPond, onOpenConnection, user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* Navbar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: '#0284c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 4 9.5 4 15a8 8 0 0 0 16 0C20 9.5 12 2 12 2z" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Water Monitor</span>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px' }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isConnected ? '#16a34a' : '#dc2626',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {isConnected ? 'Online' : 'Offline'}
            </span>
          </div>

          {onOpenConnection && (
            <button onClick={onOpenConnection} style={navBtnStyle}>Devices</button>
          )}
          <button onClick={onLogout} style={navBtnStyle}>ออกจากระบบ</button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>บ่อทั้งหมด</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>{ponds.length} บ่อ</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14,
        }}>
          {ponds.map(pond => {
            const state = getPondState(pond.id);
            if (!state) return null;
            return <PondCard key={pond.id} pondState={state} onClick={() => onSelectPond(pond.id)} />;
          })}
        </div>
      </div>

    </div>
  );
}

const navBtnStyle = {
  padding: '5px 12px', borderRadius: 6,
  border: '1px solid #e2e8f0', background: '#fff',
  color: '#475569', fontWeight: 500, fontSize: 13,
  cursor: 'pointer',
};
