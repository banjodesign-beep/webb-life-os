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

export const MILESTONE_BONUS_XP = { minor: 25, major: 50 };

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
