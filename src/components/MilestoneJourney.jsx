import React, { useMemo } from "react";

// Winding "journey" path of milestone nodes, styled with the app's own teal
// palette. Reached nodes fill teal, upcoming stay outlined/grey.
export default function MilestoneJourney({ milestones, currentStreak }) {
  const NODE_SPACING = 80;
  const AMPLITUDE = 40;
  const PADDING_TOP = 40;
  const CENTER_X = 160;

  const points = useMemo(
    () =>
      milestones.map((m, i) => ({
        ...m,
        x: CENTER_X + Math.sin(i * 0.85) * AMPLITUDE,
        y: PADDING_TOP + i * NODE_SPACING,
        reached: currentStreak >= m.day,
      })),
    [milestones, currentStreak]
  );

  const height = PADDING_TOP + milestones.length * NODE_SPACING + 24;

  const lastReachedIdx = points.reduce((acc, p, i) => (p.reached ? i : acc), -1);
  const nextIdx = Math.min(lastReachedIdx + 1, points.length - 1);
  const prevPoint = lastReachedIdx >= 0 ? points[lastReachedIdx] : { x: CENTER_X, y: 6, day: 0 };
  const nextPoint = points[nextIdx];
  const spanDays = Math.max(1, nextPoint.day - prevPoint.day);
  const progressIntoSpan = Math.min(1, (currentStreak - prevPoint.day) / spanDays);
  const currentX = prevPoint.x + (nextPoint.x - prevPoint.x) * progressIntoSpan;
  const currentY = prevPoint.y + (nextPoint.y - prevPoint.y) * progressIntoSpan;

  const fullPathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const reachedPathD = points
    .filter((p) => p.reached)
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  return (
    <div style={{ background: "#F5FAFB", border: "1px solid rgba(35,181,211,0.15)", borderRadius: 16, padding: "16px 0 8px", overflowY: "auto", maxHeight: 460, boxShadow: "0 2px 10px rgba(7,16,19,0.05)" }}>
      <svg width="100%" height={height} viewBox={`0 0 320 ${height}`}>
        <title>Milestone journey</title>
        <path d={fullPathD} fill="none" stroke="rgba(35,181,211,0.18)" strokeWidth={4} strokeLinecap="round" strokeDasharray="1 12" />
        {reachedPathD && <path d={reachedPathD} fill="none" stroke="#23B5D3" strokeWidth={4} strokeLinecap="round" />}

        {points.map((p) => (
          <g key={p.day}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.major ? 23 : 18}
              fill={p.reached ? (p.major ? "#23B5D3" : "#75ABBC") : "#FFFFFF"}
              stroke={p.reached ? "none" : "rgba(35,181,211,0.3)"}
              strokeWidth={2}
            />
            <text x={p.x} y={p.y + 4} fontSize={p.major ? 12 : 10} fontWeight={800} fill={p.reached ? "#FFFFFF" : "#A2AEBB"} textAnchor="middle" fontFamily="system-ui, sans-serif">
              {p.reached ? "✓" : ""}
            </text>
            <text
              x={p.x + (p.x > CENTER_X ? (p.major ? 32 : 26) : -(p.major ? 32 : 26))}
              y={p.y + 4}
              fontSize={11}
              fontWeight={700}
              fill={p.reached ? "#071013" : "#A2AEBB"}
              textAnchor={p.x > CENTER_X ? "start" : "end"}
              fontFamily="system-ui, sans-serif"
            >
              {p.label}
            </text>
          </g>
        ))}

        <circle cx={currentX} cy={currentY} r={8} fill="#071013" />
        <circle cx={currentX} cy={currentY} r={13} fill="none" stroke="#071013" strokeOpacity={0.25} strokeWidth={2} />
      </svg>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2, color: "#4A7080", fontSize: 12, fontWeight: 700 }}>
        🔥 Day {currentStreak} of your journey
      </div>
    </div>
  );
}
