const CONFIG = {
  normal:  { label: 'Normal',    bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
  warning: { label: 'Warning',   bg: '#fffbeb', text: '#b45309', dot: '#d97706' },
  danger:  { label: 'Danger',    bg: '#fef2f2', text: '#dc2626', dot: '#dc2626' },
  loading: { label: 'รอข้อมูล', bg: '#f8fafc', text: '#64748b', dot: '#cbd5e1' },
};

export default function StatusBadge({ status }) {
  const { label, bg, text, dot } = CONFIG[status] || CONFIG.normal;
  const blinking = status === 'danger';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color: text,
      padding: '3px 8px', borderRadius: 4,
      fontWeight: 500, fontSize: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: dot,
        display: 'inline-block', flexShrink: 0,
        animation: blinking ? 'blink 1s step-start infinite' : 'none',
      }} />
      {label}
    </span>
  );
}
