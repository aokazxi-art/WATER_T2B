import AnimatedWave from './AnimatedWave';
import { getStatusColor } from '../utils/waterLevel';

const PADDING = 16;       // ระยะ margin รอบถังใน SVG (top/right/bottom)
const PADDING_AXIS = 40; // ระยะซ้ายพิเศษสำหรับ tick label เช่น "100%" (ต้องการ ~22px)

// แสดงถังน้ำพร้อมคลื่นแอนิเมชัน — size="large" หรือ "mini"
export default function TankGauge({ pondWidth, pondDepth, fillPercent, status, id, size = 'large' }) {
  const isLarge = size === 'large';
  // กำหนดขนาด canvas สูงสุดตาม size
  const maxW = isLarge ? 260 : 110;
  const maxH = isLarge ? 300 : 120;

  // คำนวณขนาดถังให้ได้สัดส่วนจริง แต่ไม่เกิน maxW × maxH
  const aspect = pondWidth / pondDepth;
  let tankW, tankH;
  if (aspect > maxW / maxH) {
    tankW = maxW;
    tankH = maxW / aspect;
  } else {
    tankH = maxH;
    tankW = maxH * aspect;
  }
  // กำหนดขนาดขั้นต่ำให้ถังยังมองเห็นได้
  tankW = Math.max(tankW, 60);
  tankH = Math.max(tankH, 60);

  // ด้านซ้ายใช้ PADDING_AXIS (เพื่อรองรับ tick labels) เฉพาะ size="large"
  const paddingLeft = isLarge ? PADDING_AXIS : PADDING;
  const svgW = tankW + paddingLeft + PADDING; // left(axis) + right(padding)
  const svgH = tankH + PADDING * 2;
  const tx = paddingLeft; // จุดเริ่มต้น X ของถัง
  const ty = PADDING;     // จุดเริ่มต้น Y ของถัง

  const fillColor = getStatusColor(status);
  const clampedPct = Math.min(100, Math.max(0, fillPercent)); // ป้องกัน % เกินขอบเขต

  // สร้าง tick marks บนแกนซ้าย (0%, 20%, 40%, ... หรือน้อยกว่าสำหรับ mini)
  const tickCount = isLarge ? 5 : 3;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const pct = i * (100 / tickCount);
    const y = ty + tankH - (pct / 100) * tankH; // Y สูงขึ้น = % มากขึ้น
    return { pct, y };
  });

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* พื้นหลังถัง (สีฟ้าอ่อน) */}
      <rect x={tx} y={ty} width={tankW} height={tankH} rx={6} ry={6}
        fill="#e0f2fe" stroke="#94a3b8" strokeWidth={2} />

      {/* คลื่นน้ำแอนิเมชัน */}
      <g transform={`translate(${tx}, ${ty})`}>
        <AnimatedWave
          fillColor={fillColor}
          fillPercent={clampedPct}
          width={tankW}
          height={tankH}
          id={id}
        />
      </g>

      {/* เส้นขอบถังวางทับบนน้ำ เพื่อให้น้ำไม่ล้นเส้น */}
      <rect x={tx} y={ty} width={tankW} height={tankH} rx={6} ry={6}
        fill="none" stroke="#64748b" strokeWidth={2} />

      {/* tick marks พร้อม label % (แสดงเฉพาะ size="large") */}
      {isLarge && ticks.map(({ pct, y }) => (
        <g key={pct}>
          <line x1={tx - 4} y1={y} x2={tx} y2={y} stroke="#64748b" strokeWidth={1} />
          <text x={tx - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{pct}%</text>
        </g>
      ))}

      {/* ตัวเลข % กลางถัง (แสดงเฉพาะ size="large") */}
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

      {/* ไอคอนบอกตำแหน่งเซ็นเซอร์ด้านบนถัง (แสดงเฉพาะ size="large") */}
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
