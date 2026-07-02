"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  label: string;
  value: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">
        {Number(payload[0].value).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
      </div>
    </div>
  );
}

export function PerformanceChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="empty-state" style={{ padding: "2rem 1rem" }}>
        <div className="empty-state-icon">📈</div>
        <p className="empty-state-text">Grafik için yeterli veri yok</p>
      </div>
    );
  }

  return (
    <div className="chart-container chart-container-lg">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1000
                  ? `${(v / 1000).toFixed(0)}K`
                  : String(v)
            }
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#valueGradient)"
            dot={false}
            activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
