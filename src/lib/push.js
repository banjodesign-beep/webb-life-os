// src/lib/push.js
// Client side of web push. The public VAPID key is fetched from the server,
// which derives it from the private key, so the two can never disagree.
// If a saved subscription was made with a different key, it is replaced.
import { supabase } from './supabase.js'

const FN = '/.netlify/functions/push-test'

export function pushEnv() {
  const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const hasPush = typeof window !== 'undefined' && 'PushManager' in window
  const hasNotif = typeof window !== 'undefined' && 'Notification' in window
  const standalone = typeof window !== 'undefined' && (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true)
  const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  return {
    supported: hasSW && hasPush && hasNotif,
    standalone,
    ios,
    permission: hasNotif ? Notification.permission : 'unsupported',
  }
}

function b64urlToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
function bytesToB64url(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  bytes.forEach((b) => { s += String.fromCharCode(b) })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Netlify serves index.html for unknown paths, so a missing function comes
// back as HTML. Say that plainly instead of surfacing a JSON parse error.
async function readJson(r) {
  const text = await r.text()
  try { return JSON.parse(text) } catch {
    throw new Error(text.trim().startsWith('<')
      ? 'The reminder service is not deployed. Check that netlify/functions made it into the upload.'
      : `Reminder service answered ${r.status}.`)
  }
}

export async function serverStatus() {
  const r = await fetch(FN + '?action=status', { cache: 'no-store' })
  return readJson(r)
}

async function serverKey() {
  const r = await fetch(FN + '?action=key', { cache: 'no-store' })
  const j = await readJson(r)
  if (!r.ok || !j.publicKey) throw new Error(j.error || `Could not get the reminder key (${r.status}).`)
  return j.publicKey
}

export async function currentSubscription() {
  if (!pushEnv().supported) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscriptionMatchesKey(sub, key) {
  try {
    const k = sub && sub.options && sub.options.applicationServerKey
    if (!k) return true // browser does not expose it; assume fine
    return bytesToB64url(k) === key
  } catch { return true }
}

async function saveSub(sub, extra = {}) {
  const value = { ...sub.toJSON(), savedAt: new Date().toISOString(), ua: navigator.userAgent, ...extra }
  const { error } = await supabase.from('app_data').upsert({ key: 'push_sub', value, updated_at: new Date().toISOString() })
  if (error) throw new Error('Saving the subscription failed: ' + error.message)
}

// Must be called from a tap. iOS refuses permission prompts that are not.
export async function enablePush() {
  const env = pushEnv()
  if (!env.supported) {
    throw new Error(env.ios && !env.standalone
      ? 'Open Meridian from its home screen icon, not Safari. iPhone only allows reminders there.'
      : 'This browser does not support web push.')
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied'
    ? 'Notifications are blocked. Turn them on in Settings, Notifications, Meridian.'
    : 'Permission was not granted.')
  const key = await serverKey()
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (sub && !(await subscriptionMatchesKey(sub, key))) { await sub.unsubscribe(); sub = null }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(key) })
  await saveSub(sub, { keyUsed: key })
  return sub
}

// Quietly keeps the saved copy fresh on each open, and repairs a key mismatch.
export async function refreshSubscription() {
  try {
    if (!pushEnv().supported || Notification.permission !== 'granted') return false
    const sub = await currentSubscription()
    if (!sub) return false
    const key = await serverKey()
    if (!(await subscriptionMatchesKey(sub, key))) { await enablePush(); return true }
    await saveSub(sub, { keyUsed: key })
    return true
  } catch { return false }
}

export async function sendTest() {
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
  try { return await readJson(r) } catch (e) { return { ok: false, error: e.message } }
}
