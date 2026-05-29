import AnimatedWave from './AnimatedWave';
import { getStatusColor } from '../utils/waterLevel';

const PADDING = 16;

export default function TankGauge({ pondWidth, pondDepth, fillPercent, status, id, size = 'large' }) {
  const isLarge = size === 'large';
  const maxW = isLarge ? 280 : 120;
  const maxH = isLarge ? 320 : 130;

  // Proportional tank shape capped to display area
  const aspect = pondWidth / pondDepth;
  let tankW, tankH;
  if (aspect > maxW / maxH) {
    tankW = maxW;
    tankH = maxW / aspect;
  } else {
    tankH = maxH;
    tankW = maxH * aspect;
  }
  tankW = Math.max(tankW, 60);
  tankH = Math.max(tankH, 60);

  const svgW = tankW + PADDING * 2;
  const svgH = tankH + PADDING * 2;
  const tx = PADDING;
  const ty = PADDING;

  const fillColor = getStatusColor(status);
  const clampedPct = Math.min(100, Math.max(0, fillPercent));

  const tickCount = isLarge ? 5 : 3;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const pct = i * (100 / tickCount);
    const y = ty + tankH - (pct / 100) * tankH;
    return { pct, y };
  });

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Tank body background */}
      <rect x={tx} y={ty} width={tankW} height={tankH} rx={6} ry={6}
        fill="#e0f2fe" stroke="#94a3b8" strokeWidth={2} />

      {/* Animated water fill */}
      <g transform={`translate(${tx}, ${ty})`}>
        <AnimatedWave
          fillColor={fillColor}
          fillPercent={clampedPct}
          width={tankW}
          height={tankH}
          id={id}
        />
      </g>

      {/* Tank border on top */}
      <rect x={tx} y={ty} width={tankW} height={tankH} rx={6} ry={6}
        fill="none" stroke="#64748b" strokeWidth={2} />

      {/* Tick marks and labels (large only) */}
      {isLarge && ticks.map(({ pct, y }) => (
        <g key={pct}>
          <line x1={tx - 4} y1={y} x2={tx} y2={y} stroke="#64748b" strokeWidth={1} />
          <text x={tx - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{pct}%</text>
        </g>
      ))}

      {/* Level % text in center */}
      {isLarge && (
        <text
          x={tx + tankW / 2}
          y={ty + tankH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={28}
          fontWeight="bold"
          fill="white"
          stroke="#00000033"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {clampedPct.toFixed(1)}%
        </text>
      )}

      {/* Sensor mount indicator */}
      {isLarge && (
        <>
          <line x1={tx + tankW / 2 - 12} y1={ty - 8} x2={tx + tankW / 2 + 12} y2={ty - 8}
            stroke="#64748b" strokeWidth={3} strokeLinecap="round" />
          <line x1={tx + tankW / 2} y1={ty - 8} x2={tx + tankW / 2} y2={ty - 1}
            stroke="#64748b" strokeWidth={1.5} strokeDasharray="3,2" />
          <text x={tx + tankW / 2} y={ty - 11} textAnchor="middle" fontSize={8} fill="#64748b">sensor</text>
        </>
      )}
    </svg>
  );
}
