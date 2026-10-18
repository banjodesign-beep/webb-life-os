// netlify/functions/daily-reminder.mjs
// Runs every hour. Works out Ben's local time from the timezone his phone last
// reported, and sends:
//   - the evening nudge at nudgeHour (default 8pm), skipped if today is already kept
//   - the Sunday insight at insightHour (default 7pm on Sundays)
//   - an iCloud travel sync once a day at 3am local
// Every run is logged to v2-push-log so Settings can show what happened.
import { db, getRow, sendPush, logPush, localParts } from '../lib/core.mjs';
import { syncTravel } from '../lib/travel.mjs';

const FUN = [
  { title: 'All aboard the 8pm Express 🚂', body: 'Next stop: the Today tab. Tickets are free. Streaks are not.' },
  { title: 'Future Ben called', body: 'He says thanks in advance for closing out today.' },
  { title: 'Port Stephens to Pikes Peak', body: 'Wherever today took you, it only counts once it is logged.' },
  { title: 'Receipts, please 🧾', body: 'Today happened. Meridian would like proof.' },
  { title: 'Unlogged days are rumors', body: 'Make today official.' },
  { title: 'Gentle nudge, firm love', body: 'Close out Meridian. Then go be with your people.' },
  { title: 'Trans-Siberian of consistency 🚆', body: "9,289 km, one day at a time. Today's leg needs a stamp." },
  { title: "G'day, legend 🦘", body: "Quick one before tea: how'd today go?" },
  { title: 'Close the loop', body: 'You planned the day. Now let the day report back.' },
  { title: 'Mission control to Ben 🛰️', body: 'Daily telemetry not received. Please transmit.' },
  { title: 'Ninety seconds', body: 'Best return on investment of your evening.' },
  { title: 'The Ghan is boarding 🐪', body: 'Adelaide to Darwin takes 54 hours. Your checklist takes two minutes.' },
];

export function pickFun(date) {
  const n = Number(date.replace(/-/g, '')) || 0;
  return FUN[(n * 7) % FUN.length];
}

export function nudgeFor(status, date) {
  const fresh = status && status.date === date;
  if (fresh && (status.kept || status.protected)) return null; // nothing to nag about
  const streak = (status && status.streak) || 0;
  if (fresh && status.repairOpen) {
    return { title: 'Yesterday can still be saved', body: `Finish yesterday's rhythm before midnight and day ${streak + 1} stays alive.` };
  }
  if (streak >= 2) {
    const left = fresh && status.remaining ? `${status.remaining} item${status.remaining === 1 ? '' : 's'} left.` : "Today's rhythm isn't logged yet.";
    return { title: `Day ${streak + 1} is on the line 🔥`, body: left };
  }
  return pickFun(date);
}

export async function runHour(sb, now = new Date()) {
  const settings = (await getRow(sb, 'v2-settings')) || {};
  const tz = settings.tz || 'America/Denver';
  const nudgeHour = settings.nudgeHour ?? 20;
  const insightHour = settings.insightHour ?? 19;
  const local = localParts(tz, now);
  const log = (await getRow(sb, 'v2-push-log')) || { sent: {} };
  const sent = log.sent || {};
  const results = [];

  if (local.hour === 3 && !sent[`travel:${local.date}`]) {
    const v = await syncTravel(sb, local.date);
    await logPush(sb, { kind: 'travel-sync', ok: !v.error, error: v.error || null, sentKey: `travel:${local.date}` });
  }

  if (local.weekday === 'Sun' && local.hour === insightHour && !sent[`insight:${local.date}`]) {
    const status = await getRow(sb, 'v2-status');
    const opens = (await getRow(sb, 'v2-opens')) || {};
    const streak = (status && status.streak) || 0;
    const weekOpens = Object.keys(opens).filter((d) => d <= local.date && d > shift(local.date, -7)).length;
    const res = await sendPush(sb, { title: 'Your week is in 📡', body: `Streak at ${streak}. Opened Meridian ${weekOpens} of 7 days. Tap for slipping, wins and your top 3.`, url: '/?review=1', tag: 'insight' });
    await logPush(sb, { kind: 'insight', ...res, sentKey: res.ok ? `insight:${local.date}` : undefined });
    results.push(res);
  }

  if (local.hour === nudgeHour && !sent[`nudge:${local.date}`]) {
    const status = await getRow(sb, 'v2-status');
    const msg = nudgeFor(status, local.date);
    if (!msg) {
      await logPush(sb, { kind: 'nudge', ok: true, skipped: 'today already kept', sentKey: `nudge:${local.date}` });
    } else {
      const res = await sendPush(sb, { ...msg, url: '/', tag: 'nudge' });
      await logPush(sb, { kind: 'nudge', ...res, sentKey: res.ok ? `nudge:${local.date}` : undefined });
      results.push(res);
    }
  }

  if (!results.length && local.hour === 12) {
    // A midday heartbeat proves the scheduler is running even on quiet days.
    await logPush(sb, { kind: 'heartbeat', ok: true, local: `${local.date} ${local.hour}:00 ${tz}` });
  }
  return { local, results };
}

function shift(ds, n) { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

export default async () => {
  try {
    const sb = db();
    const out = await runHour(sb);
    return new Response(JSON.stringify(out), { status: 200 });
  } catch (e) {
    console.error('daily-reminder failed', e);
    try { await logPush(db(), { kind: 'error', ok: false, error: e.message }); } catch { /* ignore */ }
    return new Response('error', { status: 500 });
  }
};

export const config = { schedule: '@hourly' };
