import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// กราฟเส้นขนาดเล็กแสดงประวัติ % ระดับน้ำ
export default function Sparkline({ data, color }) {
  // แปลงอาร์เรย์ตัวเลขเป็น object ที่ recharts อ่านได้
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        {/* แกน Y ซ่อนไว้ แต่ lock ช่วง 0–100% */}
        <YAxis domain={[0, 100]} hide />

        {/* tooltip แสดง % เมื่อ hover */}
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div style={{ background: '#1e293b', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                {payload[0].value.toFixed(1)}%
              </div>
            ) : null
          }
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
