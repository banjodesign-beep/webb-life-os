// src/lib/streak.js
// One master streak. Pure functions, no React, so they can be tested in Node.
//
// A day is KEPT when its daily rhythm core items are all checked.
//   - On a travel day, the 3 travel-minimum items are enough.
//   - Legacy days (before v2) also count if v1 history scored 80% or more.
// A REST or SICK day protects the streak: it neither adds nor breaks.
// A MISSED day breaks the streak only once its repair window has closed,
// which is the end of the following day. So yesterday can still be saved today.
import { addDays, modeFor, daysBetween } from './dates.js'

const DAILY_KEY = /^cl-(weekday|saturday|sunday|travel)-(\d{4}-\d{2}-\d{2})$/

// Turns raw cl-* rows into { ds: { mode: state } }.
export function indexDayStates(rows) {
  const out = {}
  Object.keys(rows || {}).forEach((k) => {
    const m = DAILY_KEY.exec(k)
    if (!m) return
    const [, mode, ds] = m
    if (!out[ds]) out[ds] = {}
    out[ds][mode] = rows[k] || {}
  })
  return out
}

export function checkedOn(ctx, ds, id) {
  const states = ctx.dayStates[ds]
  if (!states) return false
  return Object.values(states).some((s) => s && s[id] && s[id].checked)
}

export function travelItems(ctx) {
  const all = ['travel', 'weekday', 'saturday', 'sunday'].flatMap((k) => ctx.lists[k] || [])
  const picked = (ctx.travelMin || []).map((id) => all.find((i) => i.id === id)).filter(Boolean)
  if (picked.length) return picked
  return (ctx.lists.travel || []).filter((i) => i.w === 'core').slice(0, 3)
}

// A habit added today does not reach back and un-keep the days before it.
const liveOn = (ds) => (i) => !i.addedAt || ds >= i.addedAt

// Items that must be done for the day to count.
export function requiredFor(ctx, ds) {
  if (ctx.isTravel(ds)) return travelItems(ctx).filter(liveOn(ds))
  return (ctx.lists[modeFor(ds)] || []).filter((i) => i.w === 'core').filter(liveOn(ds))
}

// Everything shown for that day (core then bonus).
export function shownFor(ctx, ds) {
  if (ctx.isTravel(ds)) return travelItems(ctx).filter(liveOn(ds))
  return (ctx.lists[modeFor(ds)] || []).filter(liveOn(ds))
}

export function dayStatus(ctx, ds) {
  const r = ctx.rest && ctx.rest[ds]
  if (r) return r // 'rest' | 'sick'
  const req = requiredFor(ctx, ds)
  if (req.length && req.every((i) => checkedOn(ctx, ds, i.id))) return 'kept'
  // A travel day that was logged against the full rhythm also counts.
  if (ctx.isTravel(ds)) {
    const full = (ctx.lists[modeFor(ds)] || []).filter((i) => i.w === 'core').filter(liveOn(ds))
    if (full.length && full.every((i) => checkedOn(ctx, ds, i.id))) return 'kept'
  }
  // v1 scores count only for days that have no checklist data of their own.
  // (v2 also writes history so v1.12 can still read it after a rollback.)
  const h = ctx.history && ctx.history[ds]
  if (!ctx.dayStates[ds] && h && !h.v2 && h.maxPts && (h.pct || 0) >= 80) return 'kept'
  return 'missed'
}

export function remainingFor(ctx, ds) {
  return requiredFor(ctx, ds).filter((i) => !checkedOn(ctx, ds, i.id)).length
}

export function computeStreak(ctx, today) {
  const first = ctx.firstDate || today
  let current = 0
  let repairOpen = false
  const yesterday = addDays(today, -1)
  const span = Math.min(3000, Math.max(0, daysBetween(first, today)))
  for (let i = 0; i <= span; i++) {
    const ds = addDays(today, -i)
    const st = dayStatus(ctx, ds)
    if (st === 'kept') { current++; continue }
    if (st === 'rest' || st === 'sick') continue
    if (ds === today) continue // today is still open
    if (ds === yesterday && ds >= first) { repairOpen = true; continue } // still repairable
    break
  }
  // Best run, walking forward with closed windows.
  let best = 0, run = 0
  for (let i = span; i >= 0; i--) {
    const ds = addDays(today, -i)
    const st = dayStatus(ctx, ds)
    if (st === 'kept') { run++; best = Math.max(best, run) }
    else if (st === 'rest' || st === 'sick') { /* protected */ }
    else if (ds === today || ds === yesterday) { /* open */ }
    else run = 0
  }
  best = Math.max(best, current)
  const todayStatus = dayStatus(ctx, today)
  return {
    current,
    best,
    todayStatus,
    todayKept: todayStatus === 'kept',
    todayProtected: todayStatus === 'rest' || todayStatus === 'sick',
    repairOpen,
    repairDate: repairOpen ? yesterday : null,
    remaining: remainingFor(ctx, today),
  }
}

// First date with any data, so the walk back has a floor.
export function firstDataDate(ctx, fallback) {
  const keys = [...Object.keys(ctx.dayStates || {}), ...Object.keys(ctx.history || {}), ...Object.keys(ctx.rest || {})]
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort()
  return keys[0] || fallback
}
