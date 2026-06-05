import TankGauge from './TankGauge';
import { getStatusColor } from '../utils/waterLevel';

// การ์ดสรุปบ่อแต่ละใบ แสดงบนหน้าหลัก — คลิกเพื่อดูรายละเอียด
export default function PondCard({ pondState, onClick }) {
  const { pond, pct, status } = pondState;
  const color = getStatusColor(status); // สีตามสถานะ (เขียว/เหลือง/แดง)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        border: `2px solid ${color}33`,        // ขอบสีโปร่งตามสถานะ
        boxShadow: '0 2px 12px #0001',
        transition: 'transform .15s, box-shadow .15s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
      // hover: ยกการ์ดขึ้นเล็กน้อยและเพิ่มเงา
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}33`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 2px 12px #0001';
      }}
    >
      {/* ชื่อบ่อ */}
      <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>{pond.name}</div>

      {/* ถังน้ำขนาดเล็ก — ใช้ sqrt(area) เป็นความกว้างในการคำนวณสัดส่วน */}
      <TankGauge
        pondWidth={Math.sqrt(pond.area)}
        pondDepth={pond.depth}
        fillPercent={pct}
        status={status}
        id={`mini-${pond.id}`}
        size="mini"
      />

      {/* จุดสีสถานะ + ตัวเลข % */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
        }} />
        <span style={{ fontWeight: 600, color, fontSize: 15 }}>
          {pct != null ? `${pct.toFixed(1)}%` : '—'}
        </span>
      </div>

      {/* พื้นที่หน้าตัดและความลึก */}
      <div style={{ fontSize: 12, color: '#64748b' }}>
        {(pond.area / 10000).toFixed(2)} ม² | ลึก {pond.depth} ซม.
      </div>
    </div>
  );
}
