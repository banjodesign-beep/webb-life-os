import React from "react";

// Reuses the app's existing .modal-overlay / .modal-sheet / .modal-title /
// .modal-sub / .modal-btn classes (defined in the main CSS block) so this
// looks native rather than bolted on.
export default function MilestoneSplash({ milestone, streakLabel, bonusXP, onDismiss }) {
  if (!milestone) return null;
  const { day, major, label } = milestone;
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "center", position: "relative", overflow: "hidden" }}
      >
        <svg
          width="100%"
          height="180"
          viewBox="0 0 320 180"
          style={{ position: "absolute", top: -10, left: 0, opacity: 0.35, pointerEvents: "none" }}
        >
          <title>Decorative rays</title>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const x2 = 160 + Math.cos(angle) * 140;
            const y2 = 70 + Math.sin(angle) * 140;
            return (
              <line
                key={i}
                x1={160}
                y1={70}
                x2={x2}
                y2={y2}
                stroke={major ? "#23B5D3" : "#75ABBC"}
                strokeWidth={1}
                strokeOpacity={0.4}
              />
            );
          })}
        </svg>

        <div
          style={{
            position: "relative",
            width: 76,
            height: 76,
            margin: "6px auto 14px",
            borderRadius: "50%",
            background: major
              ? "linear-gradient(180deg, #23B5D3 0%, #0D6B85 100%)"
              : "linear-gradient(180deg, #A6DCE9 0%, #75ABBC 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
          }}
        >
          🔥
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7A9AAA", marginBottom: 4 }}>
          {streakLabel} milestone
        </div>
        <div className="modal-title" style={{ marginBottom: 2 }}>{label}</div>
        <div className="modal-sub">
          Day {day} — {major ? "a real waypoint on the journey." : "another month in the books."}
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(35,181,211,0.1)",
            color: "#0D6B85",
            fontSize: 12,
            fontWeight: 800,
            padding: "6px 14px",
            borderRadius: 100,
            marginBottom: 18,
          }}
        >
          +{bonusXP} bonus pts
        </div>

        <button className="modal-btn" onClick={onDismiss}>Keep going</button>
      </div>
    </div>
  );
}
