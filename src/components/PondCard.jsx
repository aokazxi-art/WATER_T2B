import TankGauge from './TankGauge';
import { getStatusColor } from '../utils/waterLevel';

function MiniBattery({ level }) {
  if (level == null) return null;
  const pct   = Math.max(0, Math.min(100, level));
  const color = pct > 50 ? '#16a34a' : pct > 20 ? '#d97706' : '#dc2626';
  const fill  = Math.round((28 * pct) / 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width="36" height="15" viewBox="0 0 36 15" fill="none">
        <rect x=".75" y=".75" width="31.5" height="13.5" rx="2.25"
          stroke={color} strokeWidth="1.5" fill="none"/>
        <rect x="33" y="4.5" width="2.5" height="6" rx=".75" fill={color}/>
        <rect x="2.5" y="2.5" width={fill} height="10" rx="1.5" fill={color}/>
      </svg>
      <span style={{ fontSize: 11, color, fontWeight: 500 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

const STATUS_LABEL = { normal: 'Normal', warning: 'Warning', danger: 'Danger', loading: 'ไม่มีข้อมูล' };

function NoDataPlaceholder() {
  return (
    <div style={{
      width: '100%', height: 80,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6,
      background: '#f8fafc', borderRadius: 8,
      border: '1.5px dashed #e2e8f0',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2C12 2 4 9.5 4 15a8 8 0 0 0 16 0C20 9.5 12 2 12 2z"/>
        <line x1="12" y1="10" x2="12" y2="14"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>ไม่มีข้อมูล</span>
    </div>
  );
}

export default function PondCard({ pondState, onClick }) {
  const { pond, pct, status, battery } = pondState;
  const color  = getStatusColor(status);
  const noData = status === 'loading';

  return (
    <div
      onClick={onClick}
      style={{
        background: noData ? '#fafbfc' : '#fff',
        borderRadius: 12, padding: '16px',
        cursor: 'pointer',
        border: `1px solid ${noData ? '#f1f5f9' : '#e2e8f0'}`,
        boxShadow: '0 1px 2px rgba(0,0,0,.05)',
        transition: 'box-shadow .15s, border-color .15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.09)';
        e.currentTarget.style.borderColor = noData ? '#e2e8f0' : '#cbd5e1';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.05)';
        e.currentTarget.style.borderColor = noData ? '#f1f5f9' : '#e2e8f0';
      }}
    >
      {/* ชื่อบ่อ */}
      <div style={{
        alignSelf: 'flex-start', fontWeight: 600, fontSize: 14,
        color: noData ? '#94a3b8' : '#0f172a',
        width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{pond.name}</div>

      {/* ถังน้ำ หรือ placeholder */}
      {noData ? (
        <NoDataPlaceholder />
      ) : (
        <TankGauge
          pondWidth={Math.sqrt(pond.area)}
          pondDepth={pond.depth}
          fillPercent={pct ?? 0}
          status={status}
          id={`mini-${pond.id}`}
          size="mini"
        />
      )}

      {/* ระดับน้ำ + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
          {!noData && pct != null ? `${pct.toFixed(1)}%` : '—'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: noData ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {STATUS_LABEL[status] ?? 'Normal'}
        </span>
      </div>

      {/* Battery (ซ่อนเมื่อไม่มีข้อมูล) */}
      {!noData && battery != null && (
        <div style={{ alignSelf: 'flex-start' }}>
          <MiniBattery level={battery} />
        </div>
      )}
    </div>
  );
}
