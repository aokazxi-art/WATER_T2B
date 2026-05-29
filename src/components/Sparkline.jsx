import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data, color }) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div style={{ background: '#1e293b', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                {payload[0].value.toFixed(1)}%
              </div>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
