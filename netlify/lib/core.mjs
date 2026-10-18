// netlify/lib/core.mjs
// Shared server code for Meridian's functions. Not a function itself
// (it lives outside netlify/functions), it is bundled into each one.
import webpush from 'web-push';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// The key the v1.12 client was hard-coded with. Reported for diagnosis only.
export const LEGACY_PUBLIC_KEY =
  'BC4Shviauc16nf_lCh9jPVH9tsmlIwPuyCW9Q651kYBQYhCP_fruSBRuyzPnBjf1_zBEL4G_3DFgiM3vvOzJSuE';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(String(s).trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function envState() {
  const e = process.env;
  return {
    VAPID_PRIVATE_KEY: !!e.VAPID_PRIVATE_KEY,
    VITE_SUPABASE_URL: !!e.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: !!e.VITE_SUPABASE_ANON_KEY,
    ICS_URL: !!e.ICS_URL,
  };
}

// Derive the public key from the private key. If VAPID_PUBLIC_KEY is also set
// and disagrees, the derived one wins and the mismatch is reported.
export function vapidKeys() {
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!priv) throw new Error('VAPID_PRIVATE_KEY is not set in Netlify environment variables.');
  const raw = fromB64url(priv);
  if (raw.length !== 32) throw new Error(`VAPID_PRIVATE_KEY decodes to ${raw.length} bytes; it should be 32. It may have been pasted with extra characters.`);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(raw);
  const publicKey = b64url(ecdh.getPublicKey());
  const envPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
  return { publicKey, privateKey: priv, envPublicMismatch: !!envPublic && envPublic !== publicKey, legacyMatch: publicKey === LEGACY_PUBLIC_KEY };
}

export function db() {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key } = process.env;
  if (!url || !key) throw new Error('Supabase env vars are missing on the function.');
  return createClient(url, key);
}

export async function getRow(sb, key) {
  const { data, error } = await sb.from('app_data').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
export async function setRow(sb, key, value) {
  const { error } = await sb.from('app_data').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function logPush(sb, entry) {
  try {
    const log = (await getRow(sb, 'v2-push-log')) || { runs: [], sent: {} };
    log.runs = [{ at: new Date().toISOString(), ...entry }, ...(log.runs || [])].slice(0, 25);
    if (entry.sentKey) log.sent = { ...(log.sent || {}), [entry.sentKey]: new Date().toISOString() };
    const keys = Object.keys(log.sent || {}).sort();
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach((k) => delete log.sent[k]);
    await setRow(sb, 'v2-push-log', log);
    return log;
  } catch (e) {
    console.error('logPush failed', e);
    return null;
  }
}

// Sends one notification to the saved subscription.
// Returns { ok, status, error, endpointHost }.
export async function sendPush(sb, payload) {
  const keys = vapidKeys();
  webpush.setVapidDetails('https://benwebbos.netlify.app', keys.publicKey, keys.privateKey);
  const sub = await getRow(sb, 'push_sub');
  if (!sub || !sub.endpoint) return { ok: false, status: null, error: 'No subscription saved. Tap Turn on reminders in Meridian (from the home screen icon).' };
  const endpointHost = (() => { try { return new URL(sub.endpoint).host; } catch { return '?'; } })();
  if (sub.keyUsed && sub.keyUsed !== keys.publicKey) {
    return { ok: false, status: null, endpointHost, error: 'The phone subscribed with a different key than the server holds. Open Meridian and tap Turn on reminders again.' };
  }
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
      { TTL: 4 * 3600, urgency: 'normal' },
    );
    return { ok: true, status: res.statusCode, endpointHost };
  } catch (err) {
    const status = err.statusCode || null;
    let error = (err.body || err.message || String(err)).toString().slice(0, 300);
    if (status === 404 || status === 410) {
      await sb.from('app_data').delete().eq('key', 'push_sub');
      error = 'Subscription expired and was removed. Open Meridian and turn reminders on again.';
    } else if (status === 403) {
      error = `Push service refused the key (403): ${error}`;
    }
    return { ok: false, status, endpointHost, error };
  }
}

// Local date and hour in an IANA timezone.
export function localParts(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: p.weekday };
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
