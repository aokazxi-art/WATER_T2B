import PondCard from '../components/PondCard';

export default function HomePage({ ponds, getPondState, isConnected, onSelectPond, onOpenConnection, user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 32 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* หัวข้อหน้า */}
        <div style={{ textAlign: 'center', marginBottom: 40, position: 'relative' }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Water Level Monitor
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 16 }}>
            Select a pond to view details
          </p>

          {/* ปุ่มขวาบน */}
          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* บทบาทผู้ใช้ */}
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
              background: user?.role === 'admin' ? '#eff6ff' : '#f8fafc',
              color: user?.role === 'admin' ? '#1d4ed8' : '#64748b',
              border: `1px solid ${user?.role === 'admin' ? '#bfdbfe' : '#e2e8f0'}`,
            }}>
              {user?.displayName}
            </span>

            {/* ปุ่ม Devices — แสดงเฉพาะ admin */}
            {onOpenConnection && (
              <button
                onClick={onOpenConnection}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  padding: '8px 14px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 13,
                  boxShadow: '0 1px 4px #0001',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isConnected ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 5px ${isConnected ? '#22c55e' : '#ef4444'}`,
                }} />
                Devices
              </button>
            )}

            {/* ปุ่ม Logout */}
            <button
              onClick={onLogout}
              style={{
                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                padding: '8px 14px', cursor: 'pointer', fontWeight: 600, color: '#ef4444', fontSize: 13,
                boxShadow: '0 1px 4px #0001',
              }}
            >ออกจากระบบ</button>
          </div>
        </div>

        {/* grid การ์ดบ่อ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 24,
        }}>
          {ponds.map(pond => {
            const state = getPondState(pond.id);
            if (!state) return null;
            return (
              <PondCard
                key={pond.id}
                pondState={state}
                onClick={() => onSelectPond(pond.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
