// weeklyReview.js — the part that reads the week back to you.
//
// WHY: without this, Meridian records but never responds. A tracker tells you
// what you did; a review tells you what it means and what to change. Every
// rule here must clear a bar: it names something specific from the data, and
// it implies an action. No "great job, keep it up" filler.
//
// Pure functions — no React, no storage. Feed it the week, get observations.

const DAY_MS = 86400000;
const fmt = (d) => d.toISOString().slice(0, 10);
const modeOf = (ds) => {
  const d = new Date(ds + "T12:00:00");
  return d.getDay() === 0 ? "sunday" : d.getDay() === 6 ? "saturday" : "weekday";
};

export function lastNDates(n, endDate) {
  const end = endDate ? new Date(endDate + "T12:00:00") : new Date();
  return Array.from({ length: n }, (_, i) =>
    fmt(new Date(end.getTime() - (n - 1 - i) * DAY_MS))
  );
}

/**
 * @param history        {dateStr: {pts,maxPts,pct}}
 * @param keystoneDone   {dateStr: keystoneId}
 * @param arcs           arc objects with steps
 * @param journalEntries {dateStr: text} or array of {date}
 * @param healthLog      {dateStr: {protein, workout}} — optional
 * @returns { headline, observations: [{severity, title, body, action}] }
 */
export function buildWeeklyReview({
  history = {},
  keystoneDone = {},
  arcs = [],
  journalEntries = {},
  healthLog = {},
  prevArcsSnapshot = null,
  today = fmt(new Date()),
} = {}) {
  const week = lastNDates(7, today);
  const prevWeek = lastNDates(7, week[0]).slice(0, 7);
  const obs = [];

  const scored = week.filter((d) => history[d]?.maxPts);
  const avg = scored.length
    ? Math.round(scored.reduce((s, d) => s + (history[d].pct || 0), 0) / scored.length)
    : 0;
  const prevScored = prevWeek.filter((d) => history[d]?.maxPts);
  const prevAvg = prevScored.length
    ? Math.round(prevScored.reduce((s, d) => s + (history[d].pct || 0), 0) / prevScored.length)
    : null;

  const keystoneDays = week.filter((d) => keystoneDone[d]).length;
  const weekdays = week.filter((d) => modeOf(d) === "weekday");
  const sabbaths = week.filter((d) => modeOf(d) === "sunday");
  const sabbathHeld = sabbaths.filter((d) => {
    const h = history[d];
    return !h || (h.pct || 0) <= 60; // a light Sunday is a held Sunday
  }).length;

  // Cold start: with nothing logged there's nothing honest to say. Returning
  // criticism here would be inventing a verdict from absent data.
  if (scored.length === 0 && keystoneDays === 0) {
    return {
      headline: "Not enough logged yet to say anything useful.",
      avg: 0, prevAvg: null, keystoneDays: 0, stepsDone: 0, journalDays: 0,
      observations: [{
        severity: "low",
        title: "No data for this week",
        body: "The review reads back what you actually recorded. Right now there's nothing to read.",
        action: "Log a couple of days — backfill from the date strip if it's easier.",
      }],
    };
  }

  // ── 1. Keystone follow-through — the core promise of the app ───────
  if (keystoneDays === 0 && weekdays.length >= 3) {
    obs.push({
      severity: "high",
      title: "No keystone completed this week",
      body: `Five days of maintenance can still add up to a week where nothing moved. The checklist got attention; the larger arcs didn't.`,
      action: "Pick tomorrow's keystone tonight, before the day starts choosing for you.",
    });
  } else if (keystoneDays >= 4) {
    obs.push({
      severity: "good",
      title: `${keystoneDays} keystones cleared`,
      body: "This is the number that actually correlates with the year moving. Maintenance is table stakes; this isn't.",
      action: "Notice which domain they clustered in — that's where your momentum currently lives.",
    });
  } else if (keystoneDays > 0) {
    obs.push({
      severity: "medium",
      title: `${keystoneDays} keystone${keystoneDays === 1 ? "" : "s"} this week`,
      body: "Not nothing, but the arcs move on the order of one a day, not one a week.",
      action: "Aim for three next week. Three is the threshold where it compounds.",
    });
  }

  // ── 2. Sabbath integrity — a stated commitment, so it gets checked ──
  if (sabbaths.length > 0 && sabbathHeld === 0) {
    obs.push({
      severity: "high",
      title: "Sunday didn't look like a Sabbath",
      body: "The target is three full Sabbaths a month. A Sunday that scores like a weekday isn't one of them.",
      action: "Look at what filled it. If it was travel, that's a booking decision, not a willpower one.",
    });
  }

  // ── 3. Trend, stated plainly ────────────────────────────────────────
  if (prevAvg !== null && scored.length >= 3) {
    const delta = avg - prevAvg;
    if (delta <= -15) {
      obs.push({
        severity: "medium",
        title: `Down ${Math.abs(delta)} points on last week`,
        body: `Averaging ${avg}% against ${prevAvg}% the week before. Worth knowing whether that's a hard week or a drifting one — they need opposite responses.`,
        action: "If it was hard, spend a grace token and move on. If it was drift, cut one commitment.",
      });
    } else if (delta >= 15) {
      obs.push({
        severity: "good",
        title: `Up ${delta} points on last week`,
        body: `${avg}% against ${prevAvg}%. Something changed. Naming it is how you keep it.`,
        action: "Write one sentence in the journal about what was different.",
      });
    }
  }

  // ── 4. Untouched days — gaps, not failures ──────────────────────────
  const untouched = week.filter((d) => !history[d]?.maxPts).length;
  if (untouched >= 4) {
    obs.push({
      severity: "medium",
      title: `${untouched} days weren't logged at all`,
      body: "Missing data isn't the same as a missed day, but it means the review is guessing, and so are you.",
      action: "The date strip lets you backfill. Two minutes recovers the week.",
    });
  }

  // ── 5. Arc movement — the year, not the week ────────────────────────
  const liveArcs = arcs.filter((a) => (a.steps || []).some((s) => !s.done));
  const stepsDone = arcs.reduce((s, a) => s + (a.steps || []).filter((x) => x.done).length, 0);
  const prevStepsDone = prevArcsSnapshot
    ? prevArcsSnapshot.reduce((s, a) => s + (a.steps || []).filter((x) => x.done).length, 0)
    : null;
  if (prevStepsDone !== null && stepsDone === prevStepsDone) {
    obs.push({
      severity: "medium",
      title: "No arc moved this week",
      body: "The dailies can run indefinitely without a single long-horizon thing advancing. That's the failure mode this app exists to catch.",
      action: "Open the Larger Arc and tick one step, or admit the arc isn't real and cut it.",
    });
  } else if (prevStepsDone !== null && stepsDone > prevStepsDone) {
    obs.push({
      severity: "good",
      title: `${stepsDone - prevStepsDone} arc step${stepsDone - prevStepsDone === 1 ? "" : "s"} advanced`,
      body: "This is the slow number. It's the one that will look meaningful in a year.",
      action: null,
    });
  }

  // ── 6. Domain neglect — where attention isn't going ─────────────────
  const domainsTouched = new Set();
  Object.values(keystoneDone).forEach((id) => {
    if (typeof id === "string") domainsTouched.add(id.slice(0, 2));
  });
  const staleArcs = liveArcs
    .filter((a) => !(a.steps || []).some((s) => s.done))
    .map((a) => a.title);
  if (staleArcs.length >= 3) {
    obs.push({
      severity: "medium",
      title: `${staleArcs.length} arcs have never been started`,
      body: `Including "${staleArcs[0]}". An arc with zero steps done after months is either not a priority or is missing an obvious first move.`,
      action: "Cut one this week. A shorter honest list beats a long aspirational one.",
    });
  }

  // ── 7. Journal — the reflective loop ────────────────────────────────
  const journalDays = week.filter((d) => journalEntries[d]).length;
  if (journalDays === 0) {
    obs.push({
      severity: "low",
      title: "Nothing written this week",
      body: "Recalibrated is built from lived material, and unrecorded weeks aren't recoverable later.",
      action: "Three sentences counts. Do it now while the week is still legible.",
    });
  }

  const headline =
    obs.some((o) => o.severity === "high")
      ? "This week needs a decision, not just a look."
      : keystoneDays >= 4
      ? "A week that actually moved things."
      : scored.length === 0
      ? "Not enough logged to say anything useful."
      : "A steady week. One thing worth adjusting.";

  const order = { high: 0, medium: 1, low: 2, good: 3 };
  obs.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    headline,
    avg,
    prevAvg,
    keystoneDays,
    stepsDone,
    journalDays,
    observations: obs,
  };
}
