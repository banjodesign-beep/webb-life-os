import React, { useMemo, useRef, useEffect } from "react";

/**
 * The Journey — a walkable path of checkpoints, in the style of Duolingo's
 * unit map. Position is DAYS KEPT, not points, so a node can only be reached
 * by living days, never by ticking more boxes on one of them.
 *
 * Reached nodes fill. The current position sits between the last reached node
 * and the next one, proportional to progress into that span. Everything ahead
 * is outlined and muted, so the next checkpoint is always legible and the far
 * end of the path is visibly a long way off.
 */
export default function Journey({ daysKept, level, nodes }) {
  const SPACING = 86;
  const AMP = 52;
  const CENTER = 160;
  const TOP = 44;

  const points = useMemo(
    () =>
      nodes.map((n, i) => ({
        ...n,
        x: CENTER + Math.sin(i * 0.9) * AMP,
        y: TOP + i * SPACING,
        reached: daysKept >= n.day,
      })),
    [nodes, daysKept]
  );

  const height = TOP + nodes.length * SPACING + 40;

  const lastReachedIdx = points.reduce((acc, p, i) => (p.reached ? i : acc), -1);
  const nextIdx = Math.min(lastReachedIdx + 1, points.length - 1);
  const prev = lastReachedIdx >= 0 ? points[lastReachedIdx] : { x: CENTER, y: 8, day: 0 };
  const next = points[nextIdx];
  const span = Math.max(1, next.day - prev.day);
  const into = Math.max(0, Math.min(1, (daysKept - prev.day) / span));
  const meX = prev.x + (next.x - prev.x) * into;
  const meY = prev.y + (next.y - prev.y) * into;

  const linePath = (pts) =>
    pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

  const walked = points.filter((p) => p.reached);
  const scrollRef = useRef(null);

  // Put the current position in view without hunting for it.
  useEffect(() => {
    if (!scrollRef.current) return;
    const target = Math.max(0, meY - 150);
    scrollRef.current.scrollTop = target;
  }, [meY]);

  return (
    <div>
      {/* WHERE YOU ARE */}
      <div
        style={{
          background: "linear-gradient(145deg,#1B3443,#2F5C74)",
          borderRadius: 20,
          padding: 22,
          marginBottom: 12,
          boxShadow: "0 8px 24px rgba(35,181,211,0.22)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.75)",
            background: "rgba(255,255,255,0.15)",
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 100,
            marginBottom: 12,
          }}
        >
          Level {level.l}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
          {level.title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.55, marginBottom: 16 }}>
          {level.blurb}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>
            {daysKept}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
            days kept
          </div>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.18)", borderRadius: 100, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${level.progress}%`,
              background: "#fff",
              borderRadius: 100,
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 8, fontWeight: 600 }}>
          {level.next
            ? `${level.daysToNext} more to ${level.next.title}`
            : "The far end of the map. Keep walking."}
        </div>
      </div>

      {/* THE PATH */}
      <div
        ref={scrollRef}
        style={{
          background: "#F5FAFB",
          border: "1px solid rgba(35,181,211,0.15)",
          borderRadius: 18,
          padding: "10px 0 14px",
          overflowY: "auto",
          maxHeight: 520,
          boxShadow: "0 2px 10px rgba(7,16,19,0.05)",
        }}
      >
        <svg width="100%" height={height} viewBox={`0 0 320 ${height}`} role="img" aria-label="Journey path">
          <title>Journey path — {daysKept} days kept</title>

          <path d={linePath(points)} fill="none" stroke="rgba(43,95,125,0.16)" strokeWidth={5} strokeLinecap="round" strokeDasharray="2 14" />
          {walked.length > 1 && (
            <path d={linePath(walked)} fill="none" stroke="#2B5F7D" strokeWidth={5} strokeLinecap="round" />
          )}

          {points.map((p) => {
            const isNext = p === next && !p.reached;
            const r = p.major ? 24 : 16;
            return (
              <g key={p.day}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={p.reached ? (p.major ? "#2B5F7D" : "#6B8494") : "#FFFFFF"}
                  stroke={p.reached ? "none" : isNext ? "#2B5F7D" : "rgba(43,95,125,0.25)"}
                  strokeWidth={isNext ? 3 : 2}
                />
                <text
                  x={p.x}
                  y={p.y + 5}
                  fontSize={p.major ? 14 : 11}
                  fontWeight={800}
                  fill={p.reached ? "#FFFFFF" : "#A2AEBB"}
                  textAnchor="middle"
                  fontFamily="system-ui, sans-serif"
                >
                  {p.reached ? "✓" : p.major ? "★" : ""}
                </text>
                <text
                  x={p.x + (p.x > CENTER ? r + 10 : -(r + 10))}
                  y={p.y - (p.major ? 2 : 4)}
                  fontSize={p.major ? 12.5 : 11}
                  fontWeight={p.major ? 800 : 700}
                  fill={p.reached ? "#17384A" : isNext ? "#2B5F7D" : "#A2AEBB"}
                  textAnchor={p.x > CENTER ? "start" : "end"}
                  fontFamily="system-ui, sans-serif"
                >
                  {p.label}
                </text>
                <text
                  x={p.x + (p.x > CENTER ? r + 10 : -(r + 10))}
                  y={p.y + (p.major ? 13 : 10)}
                  fontSize={9.5}
                  fontWeight={700}
                  fill={p.reached ? "#8B99A3" : "#C2CBD3"}
                  textAnchor={p.x > CENTER ? "start" : "end"}
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="0.06em"
                >
                  {p.major ? `${p.day} DAYS` : ""}
                </text>
              </g>
            );
          })}

          {/* you are here */}
          <circle cx={meX} cy={meY} r={9} fill="#10171C" />
          <circle cx={meX} cy={meY} r={15} fill="none" stroke="#10171C" strokeOpacity={0.22} strokeWidth={2.5} />
        </svg>
      </div>
    </div>
  );
}
