// src/lib/supabase.js
// Local-mirror-first persistence.
//  - Every save lands in localStorage first, then goes to Supabase through a
//    write queue that holds at most one pending value per key.
//  - A failed write stays queued and retries on reconnect and every 30s.
//  - A circuit breaker: after one failed load, later loads in the same boot
//    read the local mirror instead of waiting on the network again.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Retries are ours (the write queue), so the client's own retry loop is off:
// on a dead connection it held every read for about 4 seconds.
export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'anon', { db: { retry: false } })

const LS = 'mer:'
const QKEY = 'mer:__queue'
const TABLE = 'app_data'

let offline = typeof navigator !== 'undefined' && navigator.onLine === false
let flushing = false
// When one request fails, every request still waiting gives up at once.
let tripResolve
let tripped = new Promise((_, rej) => { tripResolve = rej })
tripped.catch(() => {})
function trip() {
  if (!offline) { offline = true; tripResolve(new Error('offline')); notify() }
}
function reset() {
  if (offline) { offline = false; tripped = new Promise((_, rej) => { tripResolve = rej }); tripped.catch(() => {}) }
}
const listeners = new Set()

export function isOffline() { return offline }
export function onSyncChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function notify() { const s = syncState(); listeners.forEach((fn) => { try { fn(s) } catch { /* ignore */ } }) }

function lsGet(k) { try { const v = localStorage.getItem(LS + k); return v == null ? null : JSON.parse(v) } catch { return null } }
function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)) } catch { /* storage full or blocked */ } }
function lsDel(k) { try { localStorage.removeItem(LS + k) } catch { /* ignore */ } }
function qGet() { try { return JSON.parse(localStorage.getItem(QKEY) || '{}') } catch { return {} } }
function qSet(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)) } catch { /* ignore */ } }

export function syncState() { return { offline, pending: Object.keys(qGet()).length } }

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)) }

export async function load(key) {
  if (!offline) {
    try {
      const res = await Promise.race([
        supabase.from(TABLE).select('value').eq('key', key).maybeSingle(),
        timeout(4500), tripped,
      ])
      if (res.error) throw res.error
      const pending = qGet()[key]
      if (pending) return pending.v // a newer local value has not reached the server yet
      const v = res.data ? res.data.value : null
      if (v !== null && v !== undefined) lsSet(key, v)
      return v ?? null
    } catch (e) {
      trip()
    }
  }
  return lsGet(key)
}

// Loads every row whose key starts with prefix. Returns { key: value }.
export async function loadPrefix(prefix) {
  if (!offline) {
    try {
      const out = {}
      let from = 0
      const page = 1000
      for (let i = 0; i < 20; i++) {
        const res = await Promise.race([
          supabase.from(TABLE).select('key,value').like('key', prefix + '%').range(from, from + page - 1),
          timeout(8000), tripped,
        ])
        if (res.error) throw res.error
        ;(res.data || []).forEach((r) => { out[r.key] = r.value; lsSet(r.key, r.value) })
        if (!res.data || res.data.length < page) break
        from += page
      }
      const q = qGet()
      Object.keys(q).forEach((k) => { if (k.startsWith(prefix)) out[k] = q[k].v })
      return out
    } catch (e) {
      trip()
    }
  }
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(LS + prefix)) out[k.slice(LS.length)] = lsGet(k.slice(LS.length))
    }
  } catch { /* ignore */ }
  return out
}

export function save(key, val) {
  lsSet(key, val)
  const q = qGet()
  const rev = ((q[key] && q[key].r) || 0) + 1
  q[key] = { v: val, r: rev }
  qSet(q)
  notify()
  flush()
  return Promise.resolve()
}

export async function flush() {
  if (flushing) return
  flushing = true
  try {
    let q = qGet()
    for (const key of Object.keys(q)) {
      const item = q[key]
      try {
        const res = await Promise.race([
          supabase.from(TABLE).upsert({ key, value: item.v, updated_at: new Date().toISOString() }),
          timeout(8000),
        ])
        if (res.error) throw res.error
        q = qGet()
        // Only clear if nothing newer was queued while this write was in flight.
        if (q[key] && q[key].r === item.r) { delete q[key]; qSet(q) }
        reset()
      } catch (e) {
        trip()
        break
      }
    }
  } finally {
    flushing = false
    notify()
  }
}

export async function removeKeys(keys) {
  keys.forEach(lsDel)
  const q = qGet(); keys.forEach((k) => delete q[k]); qSet(q)
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100)
    const res = await supabase.from(TABLE).delete().in('key', chunk)
    if (res.error) throw res.error
  }
}

export async function listKeys() {
  const out = []
  let from = 0
  for (let i = 0; i < 20; i++) {
    const res = await supabase.from(TABLE).select('key').range(from, from + 999)
    if (res.error) throw res.error
    out.push(...(res.data || []).map((r) => r.key))
    if (!res.data || res.data.length < 1000) break
    from += 1000
  }
  return out
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { reset(); flush() })
  window.addEventListener('offline', () => trip())
  setInterval(() => { if (Object.keys(qGet()).length) { reset(); flush() } }, 30000)
}
