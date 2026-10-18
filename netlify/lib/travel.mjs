// netlify/lib/travel.mjs
// Reads a shared iCloud calendar (ICS_URL env var) and marks travel days.
import { getRow, setRow } from './core.mjs';

function unfold(text) { return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, ''); }

function icsDate(v) {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(v || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function addDays(ds, n) { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

export function parseIcs(text) {
  const events = [];
  const lines = unfold(text).split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const prop = name.split(';')[0].toUpperCase();
    if (prop === 'SUMMARY') cur.title = value.replace(/\\,/g, ',').replace(/\\n/g, ' ');
    if (prop === 'DTSTART') { cur.start = icsDate(value); cur.allDay = /VALUE=DATE(?!-)/.test(name) || value.length === 8; }
    if (prop === 'DTEND') cur.end = icsDate(value);
  }
  return events;
}

export function travelDates(events, keywords, today) {
  const kws = (keywords && keywords.length ? keywords : ['flight', 'travel', 'trip', '✈']).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const all = kws.includes('*');
  const from = addDays(today, -14), to = addDays(today, 180);
  const dates = new Set();
  const matched = [];
  events.forEach((ev) => {
    const t = (ev.title || '').toLowerCase();
    if (!all && !kws.some((k) => t.includes(k))) return;
    let end = ev.end || ev.start;
    if (ev.allDay && ev.end && ev.end > ev.start) end = addDays(ev.end, -1); // all-day DTEND is exclusive
    if (end < from || ev.start > to) return;
    matched.push({ title: ev.title, start: ev.start, end });
    let d = ev.start < from ? from : ev.start;
    let guard = 0;
    while (d <= end && d <= to && guard++ < 400) { dates.add(d); d = addDays(d, 1); }
  });
  return { dates: [...dates].sort(), matched: matched.slice(0, 40) };
}

export async function syncTravel(sb, today) {
  const url = (process.env.ICS_URL || '').trim().replace(/^webcal:\/\//i, 'https://');
  if (!url) {
    const v = { dates: [], matched: [], syncedAt: new Date().toISOString(), error: 'ICS_URL is not set in Netlify environment variables.' };
    await setRow(sb, 'v2-travel-auto', v);
    return v;
  }
  try {
    const settings = (await getRow(sb, 'v2-settings')) || {};
    const r = await fetch(url, { headers: { 'user-agent': 'Meridian travel sync' } });
    if (!r.ok) throw new Error(`Calendar link answered ${r.status}.`);
    const text = await r.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link did not return a calendar.');
    const events = parseIcs(text);
    const out = travelDates(events, settings.travelKeywords, today);
    const v = { ...out, eventCount: events.length, syncedAt: new Date().toISOString(), error: null };
    await setRow(sb, 'v2-travel-auto', v);
    return v;
  } catch (e) {
    const prev = (await getRow(sb, 'v2-travel-auto')) || {};
    const v = { ...prev, syncedAt: new Date().toISOString(), error: e.message };
    await setRow(sb, 'v2-travel-auto', v);
    return v;
  }
}
