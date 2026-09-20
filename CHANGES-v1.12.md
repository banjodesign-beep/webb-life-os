# Meridian v1.12 — engagement rebuild

Six requested changes. Three of them turned out to be the same problem.

## 1. One Five One removed

Gone from: the `g12` arc, the `pl3` keystone prompt, the `p2` platform checklist
item, the platform projects list, and the sub-copy on three checklist items
("the books or 151" now reads "the books or the platform").

Two removal traps were handled:

- **Retired arcs could survive forever.** The arc merge in `loadAll` treats any
  saved arc whose id is missing from `DEFAULT_ARCS` as a user-created custom
  arc and keeps it. `RETIRED_ARC_IDS` in `arcs.js` now filters those out.
- **Saved checklists shadow the defaults entirely** (`lists = customLists ||
  DEFAULT_LISTS`). Any device that ever opened the checklist editor would never
  have seen the removal or the rescale. `migrateLists()` now cleans saved
  copies on load. It is idempotent: values are looked up by id from the
  defaults, so re-running changes nothing, and hand-added custom items keep
  whatever you set.

## 2. Keystone stops after it is done

`keystoneDoneMap[today]` stores the completed id. That id is now looked up and
**pinned** for the rest of the day, so the rotation cannot roll a replacement.
"Not today, show another" only renders while the day is still open, and the
card flips to a kept state: *"That was the one that mattered. Nothing else gets
assigned today."*

## 3. The points had no weight — fixed at the source

The old system ran nine scoring surfaces at once and none of them related.
The arithmetic was the real culprit:

- closing a day paid `50 + streak × 10`, so one tap at a 60-day streak paid 650
- the top level sat at 6,000 lifetime points, so the whole ladder was consumed
  in roughly two months and then never moved again
- the keystone paid 40, **less than a routine day of box-ticking**, which
  inverted the app's own hierarchy
- lifetime points only ever answered "how long have I had this app"

Now every value resolves to a named tier in `meridianConfig.js`. The tier name
is the justification: if an item does not fit a tier, the item is wrong, not the
scale.

| pts | tier | what it is |
|----|------|-----------|
| 1 | Guardrail | a small protection held |
| 2 | Practice | a daily steadying thing |
| 3 | Rhythm | a weekly commitment kept |
| 5 | Move | the keystone, a monthly rhythm, a real platform action |
| 8 | Arc step | one step on a multi-month arc |
| 25 | Arc closed | a whole arc finished |

Closing a day is now a flat 3. A perfect weekday tops out at 18, so the number
on screen can be held in the head. The legend is in the app, under the ⓘ on
Today, so the scale explains itself rather than becoming folklore.

**Points are now weekly, not lifetime**, derived from `history` so they cannot
drift. One note: days logged before this deploy still carry old-scale values, so
the weekly figure reads high for about a week and then self-corrects.

## 4. Levels and the Journey tab

Levels no longer come from points. They are counted in **days kept** — a day
that `dayTier()` resolves as keystone done, half the core list done, or a
Sabbath or declared rest day. It is the one number in the app that cannot be
inflated by ticking more boxes on a single day, which is exactly why it can
carry a ladder.

Ten levels: Setting Out (0), Finding the Rhythm (7), Steady Ground (21), Rooted
(50), Weathered (100), Half a Year Kept (180), Deep Water (270), A Year Kept
(365), Second Wind (500), Long Obedience (730).

New **Journey** tab, Duolingo-style: a winding path of 18 checkpoints, walked
nodes filled, the current position sitting proportionally between the last
reached node and the next, everything ahead outlined and muted. It auto-scrolls
to where you are. Level days are the major nodes.

Also moved onto this tab: the Larger Arc, the streak milestone spine, and
Achievements (the two point-threshold badges became "100 Days Kept" and
"A Year Kept").

## 5. The Larger Arc

Off Today, onto the Journey where it has context. Today keeps a single tappable
line: *"Next on [arc]: [step]"* with the step count, which opens the Journey.

## 6. Platform demoted

No longer a Progress sub-tab. It now sits collapsed at the bottom of **Plan**,
under the week it has to fit inside, showing a one-line summary until opened.
Progress is now Stats / Rhythms / Health.

## Bottom nav is five tabs

Today, Journey, Progress, Plan, Journal. D7 (Planner keep-or-kill) is still
open and this is the moment it starts to matter.

## Verification

Babel parse → Vite build → pure Node logic tests → jsdom mount of the real dist
bundle, including a legacy-data mount with pre-rescale saved checklists.

**The build passing was not enough, again.** Lifting the arc card out of Today
left an orphan `)}`. Babel parsed it, Vite built it, and it would have rendered
a literal `)}` on the Today screen. Only the mount test caught it. A duplicate
`letterSpacing` key in the hero (pre-existing) was fixed at the same time.

## Deploying

Overwrite the whole folder. The nested structure matters: `src/lib/`,
`src/config/`, `src/components/`. `public/` has no `favicon.ico` in this zip —
the one in the repo is untouched, do not delete it.

Verify in incognito: footer should read **Meridian v1.12**.
