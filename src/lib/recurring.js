// src/lib/recurring.js
// Recurring household tasks: "Change furnace filter every 90 days".
import { addDays, toDate, localDate } from './dates.js'

export function advance(ds, every, unit) {
  const n = Math.max(1, Number(every) || 1)
  if (unit === 'week') return addDays(ds, n * 7)
  if (unit === 'month') { const d = toDate(ds); d.setMonth(d.getMonth() + n); return localDate(d) }
  return addDays(ds, n)
}

export function isDue(r, today) { return !!r.nextDue && r.nextDue <= today }
export function isOverdue(r, today) { return !!r.nextDue && r.nextDue < today }

export function complete(r, today) {
  return { ...r, lastDone: today, history: [...(r.history || []), today].slice(-60), nextDue: advance(today, r.every, r.unit) }
}

export function everyLabel(r) {
  const n = Number(r.every) || 1
  const u = r.unit || 'day'
  return n === 1 ? `Every ${u}` : `Every ${n} ${u}s`
}

// Expected completions in [from, to] for goal progress.
export function expectedBetween(r, from, to) {
  const n = Math.max(1, Number(r.every) || 1)
  const perDay = r.unit === 'week' ? 1 / (7 * n) : r.unit === 'month' ? 1 / (30.4 * n) : 1 / n
  const days = Math.max(1, Math.round((toDate(to) - toDate(from)) / 864e5) + 1)
  return Math.max(1, Math.round(days * perDay))
}
