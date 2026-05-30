import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// แปลง timestamp เป็น HH:MM:SS
function fmt(ts) {
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// กราฟเส้นขนาดเล็กแสดงประวัติ % ระดับน้ำ
export default function Sparkline({ data, color }) {
  // รองรับทั้ง number[] (เก่า) และ { pct, time }[] (ใหม่)
  const chartData = data.map((item, i) => ({
    i,
    v:    typeof item === 'number' ? item : item.pct,
    time: typeof item === 'object' ? item.time : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        {/* แกน Y ซ่อนไว้ แต่ lock ช่วง 0–100% */}
        <YAxis domain={[0, 100]} hide />

        {/* tooltip แสดง % และเวลา */}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{
                background: '#1e293b', color: '#fff',
                padding: '6px 10px', borderRadius: 6,
                fontSize: 11, lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{d.v?.toFixed(1)}%</div>
                {d.time && <div style={{ color: '#94a3b8' }}>🕐 {fmt(d.time)}</div>}
              </div>
            );
          }}
        />

        {/* พื้นที่ใต้เส้นกราฟ สีตามสถานะ */}
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false} // ปิด animation เพื่อไม่ให้กระตุกตอนอัปเดตบ่อย
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
