import { useEffect, useRef } from 'react';

// แสดงคลื่นน้ำแอนิเมชัน SVG ภายใน clipping rect ของถัง
export default function AnimatedWave({ fillColor, fillPercent, width, height, id }) {
  const waveRef = useRef(null);   // ref ของ group คลื่นที่จะเลื่อน
  const startRef = useRef(null);  // เก็บ timestamp เริ่มต้นของ animation

  // คำนวณตำแหน่ง Y ของผิวน้ำ (0 = บนสุด, height = ล่างสุด)
  const fillY = height - (fillPercent / 100) * height;
  // แอมพลิจูดคลื่น (สูงสุด 6 px หรือ 3% ของความสูงถัง)
  const waveAmp = Math.min(6, height * 0.03);
  // ความยาวคลื่น = 1.5 เท่าของความกว้างถัง
  const waveLen = width * 1.5;

  // loop แอนิเมชัน: เลื่อน group คลื่นไปทางซ้ายต่อเนื่อง
  useEffect(() => {
    let raf;
    function animate(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      // ครบรอบใน 3 วินาที แล้ว loop ด้วย modulo
      const offset = (elapsed / 3000) * waveLen;
      if (waveRef.current) {
        waveRef.current.setAttribute('transform', `translate(${-(offset % waveLen)}, 0)`);
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf); // ล้าง raf เมื่อ unmount
  }, [waveLen]);

  const clipId = `wave-clip-${id}`; // id unique สำหรับ clipPath แต่ละถัง
  // สร้าง path SVG รูปคลื่นเต็มความกว้าง 2 รอบ (เพื่อให้ loop ได้เนียน)
  const wavePoints = buildWavePath(waveLen * 2, waveAmp, fillY, height, width);

  return (
    <g>
      <defs>
        {/* ตัด path คลื่นให้ไม่เกินขอบถัง */}
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* group นี้จะถูกเลื่อนโดย animate() */}
        <g ref={waveRef}>
          <path d={wavePoints} fill={fillColor} opacity={0.9} />
        </g>
      </g>
    </g>
  );
}

// สร้าง SVG path รูปคลื่น sine ปิดด้านล่าง
function buildWavePath(totalWidth, amp, fillY, height, visibleWidth) {
  const steps = 60; // จำนวน segment ยิ่งมากยิ่งเนียน
  const stepW = totalWidth / steps;
  let d = `M 0 ${fillY + amp}`;
  for (let i = 0; i <= steps; i++) {
    const x = i * stepW;
    const y = fillY + amp * Math.sin((i / steps) * Math.PI * 4); // 2 รอบ sine
    d += ` L ${x} ${y}`;
  }
  // ปิด path ลงด้านล่าง
  d += ` L ${totalWidth} ${height} L 0 ${height} Z`;
  return d;
}
