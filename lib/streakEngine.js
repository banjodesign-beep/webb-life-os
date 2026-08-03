// streakEngine.js — pure functions for the two stakes streaks (main, health).
// No React/store dependencies.

import { isMilestoneDay, isMajorMilestone, milestoneLabel } from "../config/meridianConfig.js";

// Days between two "YYYY-MM-DD" date strings (b - a), in whole days.
export function daysBetween(aStr, bStr) {
  const a = new Date(aStr + "T12:00:00");
  const b = new Date(bStr + "T12:00:00");
  return Math.round((b - a) / 86400000);
}

/**
 * Advance (or preserve, or break) a stakes streak for "today", given whether
 * its core requirement was satisfied, whether today is a declared rest day,
 * and how many grace tokens are available in the shared pool.
 *
 * streak: { current, longest, lastDate }
 * Returns null if nothing should change yet (core not satisfied, not a rest
 * day, and lastDate is already today — i.e. no-op).
 */
export function resolveStreakAdvance({ streak, today, coreSatisfied, isRestDay, availableTokens }) {
  if (streak.lastDate === today) return null; // already resolved today
  if (!coreSatisfied && !isRestDay) return null; // nothing to do yet — wait for more taps or rest-day toggle

  let nextCurrent;
  let tokensSpent = 0;

  if (!streak.lastDate) {
    nextCurrent = 1;
  } else {
    const gap = daysBetween(streak.lastDate, today); // 1 = consecutive
    if (gap === 1) {
      nextCurrent = streak.current + 1;
    } else {
      const missedDays = Math.max(0, gap - 1);
      if (missedDays > 0 && missedDays <= availableTokens) {
        tokensSpent = missedDays;
        nextCurrent = streak.current + 1;
      } else {
        nextCurrent = 1; // streak broken, restart today
      }
    }
  }

  return {
    streak: {
      current: nextCurrent,
      longest: Math.max(nextCurrent, streak.longest || 0),
      lastDate: today,
    },
    tokensSpent,
  };
}

/**
 * Check whether advancing current -> next crossed an unacknowledged
 * milestone. lastAcked is the highest milestone day already shown to the
 * user for this streak (persisted), so re-opening the app after already
 * passing a milestone doesn't re-trigger the splash.
 */
export function checkMilestone(previousCurrent, nextCurrent, lastAcked = 0) {
  if (nextCurrent <= previousCurrent) return null;
  if (!isMilestoneDay(nextCurrent)) return null;
  if (nextCurrent <= lastAcked) return null;
  return {
    day: nextCurrent,
    major: isMajorMilestone(nextCurrent),
    label: milestoneLabel(nextCurrent),
  };
}

/** Weekly grace-token accrual. Call once per new week seen. */
export function accrueGraceToken(currentBalance, perWeek) {
  return currentBalance + perWeek;
}
