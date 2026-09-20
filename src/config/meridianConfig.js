// meridianConfig.js — the locked engagement-system spec.

export const CATEGORY_LABELS = {
  health: "Health",
  work: "Work",
  home: "Home",
  spirit: "Spirit",
};

// Only these two streaks carry stakes / grace-token protection.
export const STAKES_STREAKS = ["main", "health"];

export const GRACE_TOKENS_PER_WEEK = 1;

export const MILESTONE_BONUS_XP = { minor: 5, major: 10 };

const MILESTONE_INTERVAL_DAYS = 30;
const NAMED_MAJOR_MILESTONES = [90, 180, 300, 365];

export function isMilestoneDay(streakCount) {
  return streakCount > 0 && streakCount % MILESTONE_INTERVAL_DAYS === 0;
}

export function isMajorMilestone(streakCount) {
  if (NAMED_MAJOR_MILESTONES.includes(streakCount)) return true;
  if (streakCount > 365 && (streakCount - 365) % 100 === 0) return true;
  return false;
}

export function milestoneLabel(streakCount) {
  if (streakCount === 30) return "1 month";
  if (streakCount === 90) return "3 months";
  if (streakCount === 180) return "6 months";
  if (streakCount === 300) return "300 days";
  if (streakCount === 365) return "1 year";
  return `${streakCount} days`;
}

export function generateMilestoneList(upToDays = 420) {
  const list = [];
  for (let d = MILESTONE_INTERVAL_DAYS; d <= upToDays; d += MILESTONE_INTERVAL_DAYS) {
    list.push({ day: d, major: isMajorMilestone(d), label: milestoneLabel(d) });
  }
  NAMED_MAJOR_MILESTONES.forEach((d) => {
    if (d <= upToDays && !list.find((m) => m.day === d)) {
      list.push({ day: d, major: true, label: milestoneLabel(d) });
    }
  });
  return list.sort((a, b) => a.day - b.day);
}

// ── POINT WEIGHTING ───────────────────────────────────────────────────
// Every point value in the app resolves to one of these tiers. The tier
// name is the justification: if a new item doesn't fit a tier, the item is
// wrong, not the scale. Values are deliberately small so a number on screen
// can be held in the head. A perfect weekday tops out at 18.
export const WEIGHTS = {
  guardrail: 1,  // a small protection — hydration, caffeine cutoff, sleep kit
  practice:  2,  // a daily steadying practice — stillness, training, presence
  rhythm:    3,  // a weekly commitment kept
  move:      5,  // the keystone, a monthly rhythm, a real platform action
  arcStep:   8,  // a step on a multi-month arc
  season:   10,  // an annual, once-a-year obligation
  arcDone:  25,  // a whole arc closed
  dayClose:  3,  // flat bonus for closing a day (was 50 + streak x 10)
};

// Shown in-app so the numbers explain themselves rather than being folklore.
export const WEIGHT_LEGEND = [
  { pts: 1,  label: "Guardrail",  detail: "A small protection held." },
  { pts: 2,  label: "Practice",   detail: "A daily steadying thing." },
  { pts: 3,  label: "Rhythm",     detail: "A weekly commitment kept." },
  { pts: 5,  label: "Move",       detail: "The keystone. A monthly rhythm. A real platform action." },
  { pts: 8,  label: "Arc step",   detail: "One step on a multi-month arc." },
  { pts: 25, label: "Arc closed", detail: "A whole arc finished." },
];

// ── THE JOURNEY ───────────────────────────────────────────────────────
// Levels are counted in DAYS KEPT, not points. A day kept is a day that
// resolved to a tier: keystone done, half the core list done, or a Sabbath
// or declared rest day. This is the one number in the app that cannot be
// inflated by adding checkboxes — it equals days lived on purpose.
export const JOURNEY_LEVELS = [
  { l:1,  days:0,   title:"Setting Out",      blurb:"The first days are the hardest to make ordinary." },
  { l:2,  days:7,   title:"Finding the Rhythm", blurb:"A week held. The shape of it is starting to show." },
  { l:3,  days:21,  title:"Steady Ground",    blurb:"Three weeks. Long enough that it isn't novelty any more." },
  { l:4,  days:50,  title:"Rooted",           blurb:"Fifty days kept. This is a practice now, not an experiment." },
  { l:5,  days:100, title:"Weathered",        blurb:"A hundred days means you have already come back from a bad one." },
  { l:6,  days:180, title:"Half a Year Kept", blurb:"Two seasons. Travel, illness and a hard quarter did not end it." },
  { l:7,  days:270, title:"Deep Water",       blurb:"Nine months. Most things that start do not reach here." },
  { l:8,  days:365, title:"A Year Kept",      blurb:"One full turn of the calendar, including the weeks you wanted to quit." },
  { l:9,  days:500, title:"Second Wind",      blurb:"Past the year, still going. Nobody is watching this part." },
  { l:10, days:730, title:"Long Obedience",   blurb:"Two years in the same direction." },
];

export function journeyLevelFor(daysKept) {
  const idx = JOURNEY_LEVELS.reduce((a, lv, i) => (daysKept >= lv.days ? i : a), 0);
  const cur = JOURNEY_LEVELS[idx];
  const next = JOURNEY_LEVELS[idx + 1] || null;
  const span = next ? next.days - cur.days : 1;
  const into = next ? Math.min(1, (daysKept - cur.days) / span) : 1;
  return {
    ...cur,
    next,
    daysToNext: next ? Math.max(0, next.days - daysKept) : 0,
    progress: Math.round(into * 100),
  };
}

// Checkpoints on the path. Level days are major nodes; the rest are the
// smaller stones between them so the next one is always in reach.
const JOURNEY_MARKS = [3,7,14,21,30,50,75,100,140,180,225,270,320,365,430,500,615,730];

export function journeyNodes() {
  const levelDays = JOURNEY_LEVELS.filter(l => l.days > 0).map(l => l.days);
  const days = Array.from(new Set([...JOURNEY_MARKS, ...levelDays])).sort((a,b)=>a-b);
  return days.map(d => {
    const lv = JOURNEY_LEVELS.find(l => l.days === d);
    return { day: d, major: !!lv, label: lv ? lv.title : `${d} days`, level: lv ? lv.l : null };
  });
}
