import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─────────────────────────────────────────────────────────────────────────
// Local mirror
//
// Every successful read and every write is mirrored to localStorage. Reads
// fall back to the mirror when the network is unavailable, which is what
// makes the app usable offline AND what closes the silent-data-loss path:
// load() used to return null for both "row missing" and "request failed",
// and several call sites wrote defaults back over real data on that null.
// A cached value is returned instead, and `degraded` is raised so the UI
// can say so.
// ─────────────────────────────────────────────────────────────────────────

const LS_PREFIX = 'meridian:'
const REQUEST_TIMEOUT_MS = 6000

let degraded = false          // true once any request has been served from cache
const listeners = new Set()

function lsAvailable() {
  try {
    const k = LS_PREFIX + '__probe'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

const HAS_LS = typeof window !== 'undefined' && lsAvailable()

function readLocal(key) {
  if (!HAS_LS) return undefined
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key)
    if (raw === null) return undefined
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function writeLocal(key, val) {
  if (!HAS_LS) return
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(val))
  } catch (e) {
    // Quota exceeded — drop the oldest history slice rather than failing.
    try {
      const keys = Object.keys(window.localStorage).filter(k => k.startsWith(LS_PREFIX + 'wb-history-'))
      keys.sort()
      if (keys.length > 1) {
        window.localStorage.removeItem(keys[0])
        window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(val))
      }
    } catch { /* give up quietly; the remote write still carries the data */ }
  }
}

/** Has this browser ever cached anything? Distinguishes "offline with data" from "offline, first run". */
export function hasLocalSnapshot() {
  if (!HAS_LS) return false
  try {
    return Object.keys(window.localStorage).some(k => k.startsWith(LS_PREFIX))
  } catch {
    return false
  }
}

export function isDegraded() { return degraded }

// ─────────────────────────────────────────────────────────────────────────
// Sync status
// ─────────────────────────────────────────────────────────────────────────

let status = 'synced'   // 'synced' | 'syncing' | 'offline'

function notify() {
  listeners.forEach(fn => { try { fn(status, pending.size) } catch { /* listener threw */ } })
}

function setStatus(next) {
  if (status === next) return
  status = next
  notify()
}

export function getSyncStatus() { return { status, pending: pending.size } }

export function subscribeSync(fn) {
  listeners.add(fn)
  fn(status, pending.size)
  return () => listeners.delete(fn)
}

function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

// ─────────────────────────────────────────────────────────────────────────
// Write queue state (declared before load, which consults it)
// ─────────────────────────────────────────────────────────────────────────

let revCounter = 0
const pending = new Map()   // key -> { rev, value }
let draining = false
let retryDelay = 1000

// ─────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────

// Circuit breaker. Boot performs a parallel batch and then roughly 25
// sequential reads. Offline, without this, each one waits out its own
// timeout and the app sits on the loading screen for minutes. Once a
// request has failed we stop asking for a while and serve the mirror
// immediately, which makes an offline boot instant instead of hung.
const CIRCUIT_OPEN_MS = 15000
let circuitOpenUntil = 0

function circuitOpen() { return Date.now() < circuitOpenUntil }
function tripCircuit() { circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS }
function resetCircuit() { circuitOpenUntil = 0 }

export async function load(key) {
  // A pending local write is always newer than anything the server can return.
  if (pending.has(key)) return pending.get(key).value

  if (circuitOpen()) {
    degraded = true
    const cached = readLocal(key)
    return cached === undefined ? null : cached
  }

  try {
    const { data, error } = await withTimeout(
      supabase.from('app_data').select('value').eq('key', key).maybeSingle()
    )
    if (error) throw error
    const value = data ? data.value : null
    if (value !== null && value !== undefined) writeLocal(key, value)
    resetCircuit()
    return value
  } catch {
    tripCircuit()
    const cached = readLocal(key)
    degraded = true
    setStatus('offline')
    return cached === undefined ? null : cached
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Write — local first, then a revisioned queue
//
// Each key holds at most one pending write: the newest. That is what makes
// a fast sequence of edits safe. An older in-flight request can never
// overwrite a newer value, because the queue always carries the latest
// value per key and discards the result of any superseded attempt.
// ─────────────────────────────────────────────────────────────────────────

export async function save(key, val) {
  writeLocal(key, val)                       // durable immediately
  revCounter += 1
  pending.set(key, { rev: revCounter, value: val })
  setStatus('syncing')
  drain()                                    // fire and forget; never block the UI
  return true
}

async function drain() {
  if (draining) return
  draining = true

  while (pending.size > 0) {
    const [key, entry] = pending.entries().next().value
    let ok = false
    try {
      const { error } = await withTimeout(
        supabase.from('app_data').upsert({
          key,
          value: entry.value,
          updated_at: new Date().toISOString(),
        })
      )
      if (error) throw error
      ok = true
      resetCircuit()
    } catch {
      ok = false
      tripCircuit()
    }

    if (ok) {
      // Only clear if it wasn't superseded while in flight. If it was, the
      // newer value stays queued and goes out on the next pass.
      const current = pending.get(key)
      if (current && current.rev === entry.rev) pending.delete(key)
      retryDelay = 1000
      if (pending.size === 0) {
        degraded = false
        setStatus('synced')
      } else {
        notify()
      }
    } else {
      degraded = true
      setStatus('offline')
      draining = false
      // Back off and retry the whole queue. The data is already safe locally.
      const delay = retryDelay
      retryDelay = Math.min(retryDelay * 2, 60000)
      setTimeout(() => drain(), delay)
      return
    }
  }

  draining = false
}

/** Best-effort flush, for pagehide / route changes. */
export function flushPending() {
  if (pending.size === 0) return Promise.resolve(true)
  return drain().then(() => pending.size === 0)
}

/** Retry now — wired to the sync chip so a failed write has a visible way back. */
export function retrySync() {
  retryDelay = 1000
  resetCircuit()
  if (pending.size > 0) { setStatus('syncing'); drain() }
  return pending.size
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => retrySync())
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retrySync()
  })
  window.addEventListener('pagehide', () => { flushPending() })
}
