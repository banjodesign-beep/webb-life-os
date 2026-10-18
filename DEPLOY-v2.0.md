# Meridian v2.0

Deploy only after v1.13 has delivered a test notification to your phone.

## What v2.0 is
Four tabs: Today, To-Do, Week, Settings. One master streak, no points anywhere.
- **Today**: the streak, today's rhythm (required items, extras folded away), Rest, Sick
  and Travel day buttons, your top 3, anything due, a one-line goal pointer.
- **Streak**: a day is kept when its required items are done. Travel days need only the
  three you choose. Rest and sick days protect it. A missed day stays repairable until
  midnight the next day. Your existing checklist history backfills it.
- **To-Do**: your existing lists, now with a life dimension, due dates and steps, plus
  recurring tasks ("every 90 days"). Old weekly, monthly and annual rhythms can be brought
  back one by one as recurring tasks.
- **Week**: quarter goals (3 to 5, progress taken from the habits you link) and the next
  seven days.
- **Sunday review**: slipping, holding strong, untouched dimensions, goals, habits on
  autopilot for 8 weeks, then adjust one habit and pin the week's top 3.
- **Reminders**: 8pm nudge that names the streak at risk and is skipped once the day is
  kept. Sunday 7pm insight. Both follow your phone's timezone.
- **Splash**: a wireframe globe turns, one meridian locks to centre, and your streak counts up.

## Deploy
1. Overwrite the whole repo folder with this one. Nested folders must survive:
   `src/lib`, `src/components`, `netlify/functions`, `netlify/lib`.
   These v1 files are intentionally gone: `src/config/*`, `Journey.jsx`,
   `MilestoneJourney.jsx`, `MilestoneSplash.jsx`, `ReminderPrompt.jsx`,
   `weeklyReview.js`, `streakEngine.js`. With GitHub Desktop, deleting the old folder
   contents first and then copying this in is the clean way.
2. Optional, for travel auto-detect: in the Calendar app on your Mac, make a calendar
   (for example "Travel"), share it as a Public Calendar, copy the link, and add it in
   Netlify as `ICS_URL`. Then in Settings, Travel, set keywords (or `*` for every event on
   that calendar) and tap Sync calendar now.
3. Deploy, open from the home screen icon. Footer reads **Meridian v2.0**.
4. First run: tap the Tag banner on Today and check the dimension tags (pre-filled from v1).

## Rollback
v2.0 does not delete anything. It stops reading XP, Journey, Journal, goals, arcs and the
other retired features, and keeps writing your daily checklist in the same format v1.12
reads. Redeploying v1.12 brings it all back. When you are confident in v2.0, use
Settings, Data, Delete legacy data.

## Deliberately not in v2.0
- **Locking the database to your account.** It needs sign-in, and bundling sign-in with a
  full rewrite risks locking you out. Planned for v2.1.
- **Keystone.** It was not in the v2 brief and duplicates the required items. Easy to return.

## Verified before handoff
Logic tests (streak, repair window, travel minimum, rest days, legacy backfill, insight
rules, recurring dates), server tests (key derivation, timezone hours, nudge wording,
iCloud parsing, hourly run logging), a Vite build, and the real bundle driven in a
browser at iPhone size in light and dark: repair yesterday, travel on and off, rest day,
to-do with steps, recurring, top 3, checklist editor, tagging, goal creation, reload
persistence, offline start. Not yet verified: on your iPhone. That is your first check.
