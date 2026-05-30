import PondCard from '../components/PondCard';

// หน้าหลัก — แสดง grid การ์ดบ่อทั้งหมด
export default function HomePage({ ponds, getPondState, onSelectPond }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', padding: 32 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* หัวข้อหน้า */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Water Level Monitor
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 16 }}>
            Select a pond to view details
          </p>
        </div>

        {/* grid การ์ดบ่อ — responsive ตามขนาดหน้าจอ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 24,
        }}>
          {ponds.map(pond => {
            const state = getPondState(pond.id); // คำนวณสถานะปัจจุบันของบ่อ
            if (!state) return null;
            return (
              <PondCard
                key={pond.id}
                pondState={state}
                onClick={() => onSelectPond(pond.id)} // เปิดหน้ารายละเอียดบ่อที่เลือก
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
