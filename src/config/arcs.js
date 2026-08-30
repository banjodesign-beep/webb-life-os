// arcs.js — the Larger Arc, as checklists rather than progress percentages.
//
// WHY: a percentage with no way to move it is a status display, not a tool.
// "20th anniversary marked — 10%" tells you nothing about what to do next.
// Each arc now carries concrete, tickable steps. Progress is DERIVED from
// steps completed, so the number means something and can actually advance.

export const DEFAULT_ARCS = [
  // ── FAMILY ────────────────────────────────────────────────────────
  {
    id: "g3", domain: "family", title: "20th anniversary marked well",
    detail: "December 2, 2026. Twenty years earns more than a reservation.",
    target: "Dec 2026",
    steps: [
      { id: "s1", text: "Decide the shape of it — trip, night away, or gathering" },
      { id: "s2", text: "Talk to Jules about what she actually wants" },
      { id: "s3", text: "Childcare arranged" },
      { id: "s4", text: "Booked and paid" },
      { id: "s5", text: "Write her the letter" },
    ],
  },
  {
    id: "g1", domain: "family", title: "River's ceiling limited only by talent",
    detail: "Pride Soccer Club. Development, not just fixtures.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Home training routine running weekly" },
      { id: "s2", text: "One development conversation with Brian Contreras" },
      { id: "s3", text: "Next-level exposure path understood (ECNL / ID camps)" },
      { id: "s4", text: "River can name his own top-two priorities" },
      { id: "s5", text: "Off-season plan agreed before the season ends" },
    ],
  },
  {
    id: "g0", domain: "family", title: "Annie's pathway — depth over compliance",
    detail: "Theatre/arts as the spike. TCA College Pathways decision live.",
    target: "2029",
    steps: [
      { id: "s1", text: "College Pathways vs full enrollment decided for next year" },
      { id: "s2", text: "Course selection reviewed with the counselor" },
      { id: "s3", text: "One theatre programme researched properly" },
      { id: "s4", text: "Annie has articulated what she wants, unprompted" },
    ],
  },
  {
    id: "g2", domain: "family", title: "Parents feel genuinely cared for",
    detail: "A frequency, not a project.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Regular call rhythm established and held for a month" },
      { id: "s2", text: "One unhurried visit planned" },
      { id: "s3", text: "The harder conversation about their future started" },
    ],
  },
  {
    id: "g11", domain: "family", title: "Marriage has its own rhythm",
    detail: "Not managed in the gaps of everything else.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Weekly check-in that isn't logistics" },
      { id: "s2", text: "Monthly money review together, calm" },
      { id: "s3", text: "One night away booked, just the two of you" },
      { id: "s4", text: "Jules's business has your active support, not just approval" },
    ],
  },

  // ── PLATFORM ──────────────────────────────────────────────────────
  {
    id: "g4", domain: "platform", title: "The Sequence — manuscript complete",
    detail: "The marketing book.",
    target: "Q1 2027",
    steps: [
      { id: "s1", text: "Full outline locked" },
      { id: "s2", text: "Three chapters drafted" },
      { id: "s3", text: "Halfway — word count honest, not aspirational" },
      { id: "s4", text: "Beta readers identified" },
      { id: "s5", text: "Complete draft" },
    ],
  },
  {
    id: "g5", domain: "platform", title: "Recalibrated — publisher secured",
    detail: "Faith and leadership. Zondervan, IVP, WaterBrook.",
    target: "2027",
    steps: [
      { id: "s1", text: "Proposal drafted" },
      { id: "s2", text: "Identity framework chapter written" },
      { id: "s3", text: "Agent conversations started" },
      { id: "s4", text: "Three publishers approached" },
      { id: "s5", text: "Offer in hand" },
    ],
  },
  {
    id: "g12", domain: "platform", title: "One Five One — first real cohort",
    detail: "The men's movement. Individual invitations first.",
    target: "2027",
    steps: [
      { id: "s1", text: "The premise written in one page" },
      { id: "s2", text: "Format decided — cadence, size, commitment" },
      { id: "s3", text: "First twelve men named" },
      { id: "s4", text: "First gathering held" },
    ],
  },
  {
    id: "g6", domain: "platform", title: "BenWebb.com live",
    detail: "One home for all three projects.",
    target: "Q2 2026",
    steps: [
      { id: "s1", text: "Positioning decided — what it's for" },
      { id: "s2", text: "One page live, even if minimal" },
      { id: "s3", text: "All three projects represented" },
      { id: "s4", text: "Email capture working" },
    ],
  },

  // ── FINANCIAL ─────────────────────────────────────────────────────
  {
    id: "g7", domain: "financial", title: "Kids' education funded and automatic",
    detail: "CollegeInvest 529s for River and Annie.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Accounts open", done: true },
      { id: "s2", text: "Automatic contributions live", done: true },
      { id: "s3", text: "Annual step-up enabled", done: true },
      { id: "s4", text: "Verified once that it's actually running" },
    ],
  },
  {
    id: "g13", domain: "financial", title: "Household financial architecture complete",
    detail: "Structure before optimization.",
    target: "2027",
    steps: [
      { id: "s1", text: "Dashboard Jules-managed and used monthly" },
      { id: "s2", text: "Spousal Roth for Jules opened and funded" },
      { id: "s3", text: "Fee-only fiduciary planner engaged" },
      { id: "s4", text: "Truck refi decided on actual DTI numbers" },
      { id: "s5", text: "Wills, beneficiaries, and estate basics confirmed" },
    ],
  },

  // ── HEALTH ────────────────────────────────────────────────────────
  {
    id: "g9", domain: "health", title: "Strength as the primary modality",
    detail: "Shoulder-safe. Lower body is the lever.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Lower-body session three times in one week" },
      { id: "s2", text: "Held that for four consecutive weeks" },
      { id: "s3", text: "Progressive load on split squats and RDLs" },
      { id: "s4", text: "Shoulder-safe substitutions are automatic, not remembered" },
    ],
  },
  {
    id: "g14", domain: "health", title: "Body composition trending, plateau broken",
    detail: "Protocol plus resistance work. Patience over aggression.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Protein target hit five days in a week" },
      { id: "s2", text: "Weight logged consistently for a month, without drama" },
      { id: "s3", text: "Plateau strategy reviewed with the doctor" },
      { id: "s4", text: "One trend line moving in the right direction" },
    ],
  },
  {
    id: "g10", domain: "health", title: "Travel doesn't dismantle the routine",
    detail: "The schedule is the constraint. Design for it.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Sleep kit permanently packed" },
      { id: "s2", text: "Hotel-room workout that needs no equipment" },
      { id: "s3", text: "Protein plan that survives airports" },
      { id: "s4", text: "One full trip completed without losing the thread" },
    ],
  },

  // ── FAITH & IDENTITY ──────────────────────────────────────────────
  {
    id: "g15", domain: "faith", title: "Sabbath genuinely protected",
    detail: "Three full Sabbaths a month, worship team factored in.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "Sabbaths blocked in advance, not defended reactively" },
      { id: "s2", text: "Three in a single month, actually held" },
      { id: "s3", text: "Travel booked around them at least once" },
      { id: "s4", text: "Worship commitments sized so they don't consume the rest" },
    ],
  },
  {
    id: "g16", domain: "faith", title: "Living from secure humility",
    detail: "Who am I? What am I worth? Am I safe? — the open thread.",
    target: "Ongoing",
    steps: [
      { id: "s1", text: "The three questions written out in your own words" },
      { id: "s2", text: "Default posture named honestly" },
      { id: "s3", text: "One recurring trigger for the fragile posture identified" },
      { id: "s4", text: "A practice that interrupts it, running weekly" },
      { id: "s5", text: "It shows up in how you lead, not just how you journal" },
    ],
  },
];

// Progress is derived, never stored — so it can't drift from reality.
export function arcProgress(arc) {
  const steps = arc.steps || [];
  if (steps.length === 0) return arc.completed ? 100 : 0;
  const done = steps.filter((s) => s.done).length;
  return Math.round((done / steps.length) * 100);
}

export function nextStep(arc) {
  return (arc.steps || []).find((s) => !s.done) || null;
}

export function isArcComplete(arc) {
  const steps = arc.steps || [];
  return steps.length > 0 && steps.every((s) => s.done);
}

// Surface an arc that still has work in it, rotating daily but skipping
// finished ones so the card never shows a completed arc as "today's focus".
export function pickArc(arcs, dayOfYear, offset = 0) {
  const live = arcs.filter((a) => !a.completed && !isArcComplete(a));
  if (live.length === 0) return arcs[0] || null;
  return live[(dayOfYear + offset) % live.length];
}
