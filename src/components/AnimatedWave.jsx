import { useEffect, useRef } from 'react';

// Renders an animated SVG wave fill inside a clipping rect
export default function AnimatedWave({ fillColor, fillPercent, width, height, id }) {
  const waveRef = useRef(null);
  const animRef = useRef(null);
  const startRef = useRef(null);

  const fillY = height - (fillPercent / 100) * height;
  const waveAmp = Math.min(6, height * 0.03);
  const waveLen = width * 1.5;

  useEffect(() => {
    let raf;
    function animate(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const offset = (elapsed / 3000) * waveLen; // full cycle in 3s
      if (waveRef.current) {
        waveRef.current.setAttribute('transform', `translate(${-(offset % waveLen)}, 0)`);
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [waveLen]);

  const clipId = `wave-clip-${id}`;
  const wavePoints = buildWavePath(waveLen * 2, waveAmp, fillY, height, width);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g ref={waveRef}>
          <path d={wavePoints} fill={fillColor} opacity={0.9} />
        </g>
      </g>
    </g>
  );
}

function buildWavePath(totalWidth, amp, fillY, height, visibleWidth) {
  const steps = 60;
  const stepW = totalWidth / steps;
  let d = `M 0 ${fillY + amp}`;
  for (let i = 0; i <= steps; i++) {
    const x = i * stepW;
    const y = fillY + amp * Math.sin((i / steps) * Math.PI * 4);
    d += ` L ${x} ${y}`;
  }
  d += ` L ${totalWidth} ${height} L 0 ${height} Z`;
  return d;
}
