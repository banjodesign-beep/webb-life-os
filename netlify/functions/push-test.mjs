// netlify/functions/push-test.mjs
// HTTP endpoint the app calls from Settings.
//   GET  ?action=key     -> { publicKey }   (derived from VAPID_PRIVATE_KEY)
//   GET  ?action=status  -> env, key checks, saved subscription, recent runs
//   POST {action:'test'} -> sends a notification now and reports exactly what happened
//   POST {action:'travel-sync'} -> re-reads the iCloud calendar now
import { envState, vapidKeys, db, getRow, sendPush, logPush, json, localParts } from '../lib/core.mjs';
import { syncTravel } from '../lib/travel.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || (req.method === 'POST' ? ((await req.json().catch(() => ({}))).action) : 'status');

  if (action === 'key') {
    try { return json({ publicKey: vapidKeys().publicKey }); }
    catch (e) { return json({ error: e.message }, 500); }
  }

  if (action === 'status') {
    const out = { env: envState(), now: new Date().toISOString() };
    try { const k = vapidKeys(); out.publicKey = k.publicKey; out.legacyKeyMatch = k.legacyMatch; out.envPublicMismatch = k.envPublicMismatch; }
    catch (e) { out.keyError = e.message; }
    try {
      const sb = db();
      const sub = await getRow(sb, 'push_sub');
      out.subscription = sub ? {
        saved: true,
        savedAt: sub.savedAt || null,
        endpointHost: (() => { try { return new URL(sub.endpoint).host; } catch { return '?'; } })(),
        keyMatches: sub.keyUsed ? sub.keyUsed === out.publicKey : null,
      } : { saved: false };
      const log = await getRow(sb, 'v2-push-log');
      out.runs = (log && log.runs) || [];
      const settings = (await getRow(sb, 'v2-settings')) || {};
      out.local = localParts(settings.tz);
      out.settings = { tz: settings.tz || 'America/Denver', nudgeHour: settings.nudgeHour ?? 20, insightHour: settings.insightHour ?? 19 };
    } catch (e) { out.dbError = e.message; }
    return json(out);
  }

  if (action === 'test') {
    try {
      const sb = db();
      const res = await sendPush(sb, { title: 'Meridian is wired up 🛰️', body: 'If you can read this, reminders work. See you at the evening check-in.', url: '/', tag: 'test' });
      await logPush(sb, { kind: 'test', ...res });
      return json(res, 200);
    } catch (e) {
      return json({ ok: false, error: e.message }, 200);
    }
  }

  if (action === 'travel-sync') {
    try {
      const sb = db();
      const settings = (await getRow(sb, 'v2-settings')) || {};
      const v = await syncTravel(sb, localParts(settings.tz).date);
      return json({ ok: !v.error, ...v });
    } catch (e) { return json({ ok: false, error: e.message }); }
  }

  return json({ error: 'unknown action' }, 400);
};
