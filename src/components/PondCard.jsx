import TankGauge from './TankGauge';
import { getStatusColor } from '../utils/waterLevel';

export default function PondCard({ pondState, onClick }) {
  const { pond, pct, status } = pondState;
  const color = getStatusColor(status);

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        border: `2px solid ${color}33`,
        boxShadow: '0 2px 12px #0001',
        transition: 'transform .15s, box-shadow .15s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}33`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 2px 12px #0001';
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>{pond.name}</div>
      <TankGauge
        pondWidth={pond.width}
        pondDepth={pond.depth}
        fillPercent={pct}
        status={status}
        id={`mini-${pond.id}`}
        size="mini"
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
        }} />
        <span style={{ fontWeight: 600, color, fontSize: 15 }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        {pond.width} × {pond.length} × {pond.depth} cm
      </div>
    </div>
  );
}
