// netlify/functions/daily-reminder.mjs
// Sends one push a day reminding Ben to update Meridian.
// Needs one new Netlify env var: VAPID_PRIVATE_KEY.
// Reuses the existing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY =
  'BC4Shviauc16nf_lCh9jPVH9tsmlIwPuyCW9Q651kYBQYhCP_fruSBRuyzPnBjf1_zBEL4G_3DFgiM3vvOzJSuE';

const MESSAGES = [
  { title: 'Keystone check 🗝️', body: "Did today's keystone get done? Go claim it." },
  { title: 'Momentum is listening', body: "It noticed you haven't checked in. Don't leave it hanging." },
  { title: 'Tiny ritual, big arc', body: 'Two minutes in Meridian today, a better Journey tomorrow.' },
  { title: 'All aboard the 8pm Express 🚂', body: 'Next stop: the Today tab. Tickets are free. Streaks are not.' },
  { title: 'Future Ben called', body: 'He says thanks in advance for logging today.' },
  { title: 'Streak status: nervous', body: 'Your streak is pacing the hallway. Put it out of its misery.' },
  { title: 'Port Stephens to Pikes Peak', body: 'Wherever today took you, it only counts once it is logged.' },
  { title: 'The journal is open', body: "One honest sentence about today. That's the whole ask." },
  { title: 'Receipts, please 🧾', body: 'Today happened. Meridian would like proof.' },
  { title: 'Quick lap before bed', body: 'Checklist, health, one line in the journal. Done.' },
  { title: 'Unlogged days are rumors', body: 'Make today official.' },
  { title: 'Gentle nudge, firm love', body: 'Fill out Meridian. Then go be with your people.' },
  { title: 'Trans-Siberian of consistency 🚆', body: "9,289 km, one day at a time. Today's leg needs a stamp." },
  { title: 'The Journey map is waiting', body: 'One more step on the trail, as soon as you log it.' },
  { title: 'Scoreboard check', body: 'What won today? Write it down before it fades.' },
  { title: 'Low effort, high return', body: 'Ninety seconds. Best ROI of your evening.' },
  { title: "G'day, legend 🦘", body: "Quick one before tea: how'd today go?" },
  { title: 'Close the loop', body: 'You planned the day. Now let the day report back.' },
  { title: 'Mission control to Ben 🛰️', body: 'Daily telemetry not received. Please transmit.' },
  { title: 'Small wins still count', body: 'Even a messy day deserves a check-in.' },
];

// Scrambled rotation: all 20 appear once before any repeats (7 is coprime with 20).
export function pickMessage(now = Date.now()) {
  const day = Math.floor(now / 86_400_000);
  return MESSAGES[(day * 7) % MESSAGES.length];
}

export default async () => {
  const { VAPID_PRIVATE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
  if (!VAPID_PRIVATE_KEY || !VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    console.error('Missing env var. Check VAPID_PRIVATE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.');
    return new Response('missing env', { status: 500 });
  }

  webpush.setVapidDetails('https://benwebbos.netlify.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from('app_data')
    .select('value')
    .eq('key', 'push_sub')
    .maybeSingle();

  if (error || !data?.value) {
    console.log('No push subscription saved yet.', error || '');
    return new Response('no subscription', { status: 200 });
  }

  const msg = pickMessage();
  try {
    await webpush.sendNotification(data.value, JSON.stringify({ ...msg, url: '/' }));
    console.log('Sent:', msg.title);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await supabase.from('app_data').delete().eq('key', 'push_sub');
      console.log('Subscription expired and was removed. Open Meridian to re-enable.');
    } else {
      console.error('Push failed', err.statusCode, err.body || err.message);
    }
  }
  return new Response('ok', { status: 200 });
};

// 02:00 UTC = 8pm Mountain in summer (MDT), 7pm in winter (MST).
export const config = { schedule: '0 2 * * *' };
