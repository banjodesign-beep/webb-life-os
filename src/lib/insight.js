// src/lib/insight.js
// The Sunday weekly insight. Rule-based, no AI. Every line names something
// specific. Empty weeks get an empty-state branch instead of invented verdicts.
import { addDays, mondayOf, range, quarterOf, quarterStart } from './dates.js'
import { shownFor, checkedOn, dayStatus } from './streak.js'
import { allItems, DIM_IDS } from './model.js'
import { expectedBetween } from './recurring.js'

function itemRate(ctx, id, days) {
  let sched = 0, done = 0
  days.forEach((ds) => {
    if (ds < (ctx.firstDate || ds)) return
    const st = dayStatus(ctx, ds)
    if (st === 'rest' || st === 'sick') return
    if (!shownFor(ctx, ds).some((i) => i.id === id)) return
    const hit = checkedOn(ctx, ds, id)
    if (ctx.today && ds >= ctx.today && !hit) return // today is still open, not a miss
    sched++
    if (hit) done++
  })
  return { sched, done, rate: sched ? done / sched : null }
}

export function weekDays(today) {
  const mon = mondayOf(today)
  return range(mon, today)
}

export function goalProgress(ctx, goal, recurring, today) {
  ctx = { ...ctx, today }
  const from = quarterStart(goal.quarter || quarterOf(today))
  const days = range(from, today)
  let sched = 0, done = 0
  ;(goal.itemIds || []).forEach((id) => {
    const r = itemRate(ctx, id, days); sched += r.sched; done += r.done
  })
  ;(goal.recurringIds || []).forEach((rid) => {
    const rt = (recurring || []).find((x) => x.id === rid)
    if (!rt) return
    const exp = expectedBetween(rt, from, today)
    const got = (rt.history || []).filter((d) => d >= from && d <= today).length
    sched += exp; done += Math.min(got, exp)
  })
  return sched ? Math.round((done / sched) * 100) : null
}

export function buildInsight({ ctx, today, todos = [], recurring = [], goals = [], opens = {}, streak, gradAck = {} }) {
  ctx = { ...ctx, today }
  const week = weekDays(today)
  const weekStart = week[0]
  const trailing = range(addDays(weekStart, -28), addDays(weekStart, -1))
  const items = allItems(ctx.lists)

  const rows = items.map((it) => ({ it, now: itemRate(ctx, it.id, week), before: itemRate(ctx, it.id, trailing) }))
  const hasData = rows.some((r) => r.now.sched > 0 && r.now.done > 0) || todos.some((t) => t.doneAt && t.doneAt >= weekStart)

  const slipping = rows
    .filter((r) => r.now.sched >= 1 && r.before.sched >= 3 && r.before.rate - r.now.rate >= 0.2)
    .sort((a, b) => (b.before.rate - b.now.rate) - (a.before.rate - a.now.rate))
    .slice(0, 3)
    .map((r) => ({ id: r.it.id, text: r.it.text, dim: r.it.dim, now: Math.round(r.now.rate * 100), before: Math.round(r.before.rate * 100) }))

  const wins = rows
    .filter((r) => r.now.sched >= 2 && r.now.rate >= 0.9)
    .sort((a, b) => b.now.sched - a.now.sched)
    .slice(0, 5)
    .map((r) => ({ id: r.it.id, text: r.it.text, dim: r.it.dim, now: Math.round(r.now.rate * 100) }))

  // Dimension completions this week: checklist checks, finished to-dos, recurring done.
  const dimCount = Object.fromEntries(DIM_IDS.map((d) => [d, 0]))
  week.forEach((ds) => items.forEach((it) => { if (checkedOn(ctx, ds, it.id)) dimCount[it.dim] = (dimCount[it.dim] || 0) + 1 }))
  todos.forEach((t) => { if (t.done && t.doneAt && t.doneAt >= weekStart && t.dim) dimCount[t.dim] = (dimCount[t.dim] || 0) + 1 })
  recurring.forEach((r) => (r.history || []).forEach((d) => { if (d >= weekStart && d <= today && r.dim) dimCount[r.dim] = (dimCount[r.dim] || 0) + 1 }))
  const neglected = hasData ? DIM_IDS.filter((d) => !dimCount[d]) : []

  // Graduation: 100% in each of the last 8 full weeks (with this week in progress excluded).
  const graduation = []
  items.forEach((it) => {
    if (gradAck[it.id] && gradAck[it.id] >= addDays(today, -56)) return
    const thisWeek = itemRate(ctx, it.id, week)
    if (thisWeek.sched && thisWeek.rate < 1) return // slipping now, not on autopilot
    let ok = true
    for (let w = 1; w <= 8; w++) {
      const s = addDays(weekStart, -7 * w)
      const r = itemRate(ctx, it.id, range(s, addDays(s, 6)))
      if (!r.sched || r.rate < 1) { ok = false; break }
    }
    if (ok) graduation.push({ id: it.id, text: it.text, dim: it.dim })
  })
  graduation.splice(3) // three decisions per review is plenty

  const goalRows = goals.filter((g) => g.status !== 'closed').map((g) => ({
    id: g.id, title: g.title, dim: g.dim, quarter: g.quarter, pct: goalProgress(ctx, g, recurring, today),
    stale: g.quarter && g.quarter !== quarterOf(today),
  }))

  const opensThisWeek = week.filter((d) => opens[d]).length

  return { weekStart, hasData, slipping, wins, neglected, dimCount, graduation, goals: goalRows, opensThisWeek, daysInWeek: week.length, streak: streak ? streak.current : 0 }
}
