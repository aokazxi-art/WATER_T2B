import { useEffect, useRef } from 'react';

const CONFIG = {
  normal:  { label: 'Normal',  bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
  warning: { label: 'Warning', bg: '#fef9c3', text: '#854d0e', dot: '#f59e0b' },
  danger:  { label: 'Danger',  bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

export default function StatusBadge({ status }) {
  const { label, bg, text, dot } = CONFIG[status] || CONFIG.normal;
  const blinking = status === 'danger';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, color: text,
      padding: '4px 12px', borderRadius: 999,
      fontWeight: 600, fontSize: 13,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: dot,
        animation: blinking ? 'blink 1s step-start infinite' : 'none',
        display: 'inline-block',
      }} />
      {label}
    </span>
  );
}
