// src/lib/dates.js
// All day boundaries use the device's current timezone, so a trip across
// timezones moves the day with Ben rather than breaking it.

export const localDate = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const toDate = (ds) => new Date(ds + 'T12:00:00')
export const addDays = (ds, n) => { const d = toDate(ds); d.setDate(d.getDate() + n); return localDate(d) }
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5)
export const modeFor = (ds) => { const g = toDate(ds).getDay(); return g === 0 ? 'sunday' : g === 6 ? 'saturday' : 'weekday' }
export const mondayOf = (ds) => { const d = toDate(ds); const off = (d.getDay() + 6) % 7; return addDays(ds, -off) }
export const quarterOf = (ds) => { const d = toDate(ds); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` }
export const quarterStart = (q) => { const [y, n] = q.split('-Q').map(Number); return `${y}-${String((n - 1) * 3 + 1).padStart(2, '0')}-01` }
export const range = (from, to) => { const out = []; let d = from; let guard = 0; while (d <= to && guard++ < 4000) { out.push(d); d = addDays(d, 1) } return out }
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export const fmtLong = (ds) => toDate(ds).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
export const fmtShort = (ds) => toDate(ds).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export const fmtDay = (ds) => toDate(ds).toLocaleDateString('en-US', { weekday: 'short' })
export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver' } catch { return 'America/Denver' } }
