"use client";

interface Slice {
  label: string;
  value: number;
  color: string;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
  "#f97316", "#a855f7", "#06b6d4", "#84cc16",
];

export function AllocationPieChart({ data }: { data: Slice[] }) {
  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "1.5rem" }}>
        <div className="empty-state-icon">🥧</div>
        <p className="empty-state-text">Dağılım verisi yok</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  // SVG donut chart
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const strokeWidth = 28;

  let startAngle = -90;
  const arcs = data.map((slice) => {
    const pct = slice.value / total;
    const angle = pct * 360;
    const endAngle = startAngle + angle;

    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = angle > 180 ? 1 : 0;

    const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
    startAngle = endAngle;

    return { ...slice, d, pct };
  });

  return (
    <div className="pie-chart-wrapper">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${arc.color}40)`,
              transition: "all 0.3s ease",
            }}
          />
        ))}
        <text
          x={cx}
          y={cx - 6}
          textAnchor="middle"
          fill="#f1f5f9"
          fontSize="14"
          fontWeight="700"
        >
          {data.length}
        </text>
        <text
          x={cx}
          y={cx + 12}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="10"
        >
          pozisyon
        </text>
      </svg>

      <div className="pie-legend">
        {arcs.map((arc, i) => (
          <div className="pie-legend-item" key={i}>
            <span className="pie-legend-dot" style={{ background: arc.color }} />
            <span>{arc.label}</span>
            <span className="pie-legend-value">
              %{(arc.pct * 100).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export { COLORS };
