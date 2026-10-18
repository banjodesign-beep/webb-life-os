// src/App.jsx
// Meridian v2.0. Four tabs: Today, To-Do, Week, Settings.
// One master streak. No points anywhere.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { load, save, loadPrefix, isOffline, onSyncChange, syncState, listKeys, removeKeys } from './lib/supabase.js'
import { localDate, addDays, modeFor, mondayOf, quarterOf, range, fmtLong, fmtShort, fmtDay, deviceTz, isDateStr } from './lib/dates.js'
import { DIMENSIONS, DIM_IDS, LIST_KEYS, LIST_LABELS, DEFAULT_TRAVEL_MIN, normalizeLists, allItems, dimOf, dimName, clean } from './lib/model.js'
import { indexDayStates, computeStreak, shownFor, requiredFor, checkedOn, firstDataDate, travelItems } from './lib/streak.js'
import { buildInsight, goalProgress } from './lib/insight.js'
import { advance, isDue, isOverdue, complete, everyLabel } from './lib/recurring.js'
import { refreshSubscription } from './lib/push.js'
import Splash from './components/Splash.jsx'
import RemindersPanel from './components/RemindersPanel.jsx'

export const APP_VERSION = '2.0'

const K = {
  lists: 'v2-lists', settings: 'v2-settings', travel: 'v2-travel', travelAuto: 'v2-travel-auto', rest: 'v2-rest',
  goals: 'v2-goals', recurring: 'v2-recurring', top3: 'v2-top3', opens: 'v2-opens', grad: 'v2-grad', status: 'v2-status',
  reviewDone: 'v2-review-done', migrated: 'v2-migrated', todos: 'wb-todos-v1', cats: 'wb-categories-v1',
}

const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// Keys that belonged to features removed in v2. Deleted only when Ben taps the button.
const LEGACY_PATTERNS = [
  /^wb-totalxp$/, /^wb-streaks-v4$/, /^wb-ach-v3$/, /^wb-journal-/, /^wb-goals-v5$/, /^wb-arcs-/, /^wb-keystone-/,
  /^wb-health-streak$/, /^wb-milestone-ack$/, /^wb-grace-/, /^wb-weekplan-/, /^wb-planarchive$/, /^wb-friends-v2$/,
  /^wb-fin-v2$/, /^wb-vision-anchor$/, /^wb-values-v1$/, /^wb-quick-notes-v1$/, /^wb-avatar$/, /^wb-protein-/,
  /^wb-workouts-/, /^wb-lesson-/, /^cl-weekly-/, /^cl-monthly-/, /^cl-annual-/, /^cl-ijm-/, /^cl-platform-/,
]

function useToday() {
  const [today, setToday] = useState(localDate())
  useEffect(() => {
    const check = () => setToday((t) => (t === localDate() ? t : localDate()))
    const id = setInterval(check, 30000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [])
  return today
}

function TabIcon({ id }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'tab-ic' }
  if (id === 'today') return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17" /><path d="M12 3.5c3 2.4 4.5 5.2 4.5 8.5s-1.5 6.1-4.5 8.5" /></svg>
  if (id === 'todo') return <svg {...p}><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4 6.5l1 1 2-2M4 12l1 1 2-2" /><circle cx="5" cy="17.5" r="1" /></svg>
  if (id === 'week') return <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
  return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></svg>
}

function DimDot({ dim, names }) {
  const d = dimOf(dim)
  return <span className="dim-dot" style={{ '--dim': d.color }} title={dimName(dim, names)} aria-label={dimName(dim, names)} />
}

function DimPicker({ value, onChange, names, compact }) {
  return (
    <div className={`dim-pick ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Life dimension">
      {DIMENSIONS.map((d) => (
        <button key={d.id} type="button" role="radio" aria-checked={value === d.id}
          className={`dim-chip ${value === d.id ? 'on' : ''}`} style={{ '--dim': d.color }} onClick={() => onChange(d.id)}>
          {dimName(d.id, names)}
        </button>
      ))}
    </div>
  )
}

function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    document.body.classList.add('locked')
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('locked') }
  }, [onClose])
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet">
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

function Check({ done, onClick, label, sub, icon, dim, names, disabled }) {
  return (
    <button type="button" className={`check ${done ? 'done' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={done}>
      <span className="check-box" aria-hidden="true">{done ? '✓' : ''}</span>
      <span className="check-icon" aria-hidden="true">{icon}</span>
      <span className="check-text">
        <span className="check-label">{label}</span>
        {sub ? <span className="check-sub">{sub}</span> : null}
      </span>
      {dim ? <DimDot dim={dim} names={names} /> : null}
    </button>
  )
}

export default function App() {
  const today = useToday()
  const [ready, setReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const [tab, setTab] = useState('today')
  const [sheet, setSheet] = useState(null) // {type, ...}
  const [toast, setToast] = useState('')
  const [sync, setSync] = useState(syncState())

  const [lists, setLists] = useState(normalizeLists(null, null))
  const [dayRows, setDayRows] = useState({})
  const [history, setHistory] = useState({})
  const [rest, setRest] = useState({})
  const [travel, setTravel] = useState({ overrides: {}, trips: [], minIds: DEFAULT_TRAVEL_MIN })
  const [travelAuto, setTravelAuto] = useState({ dates: [] })
  const [settings, setSettings] = useState({ nudgeHour: 20, insightHour: 19, travelKeywords: ['flight', 'travel', 'trip'], dimNames: {}, taggingDone: false })
  const [goals, setGoals] = useState([])
  const [recurring, setRecurring] = useState([])
  const [todos, setTodos] = useState([])
  const [cats, setCats] = useState([{ id: 'cat-default', name: 'General', collapsed: false }])
  const [top3, setTop3] = useState({ week: null, ids: [] })
  const [opens, setOpens] = useState({})
  const [gradAck, setGradAck] = useState({})
  const [reviewDone, setReviewDone] = useState(null)
  const [v1Rhythms, setV1Rhythms] = useState([])
  const [viewDs, setViewDs] = useState(null) // null = today; yesterday while repairing

  const flash = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600) }, [])
  useEffect(() => onSyncChange(setSync), [])

  // ── LOAD ───────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    ;(async () => {
      const y = new Date().getFullYear()
      const [v2Lists, v1Lists, rows, restRows, h1, h0, st, tv, ta, rs, gl, rc, td, ct, t3, op, ga, rd, mig] = await Promise.all([
        load(K.lists), load('wb-custom-lists'), loadPrefix('cl-'), loadPrefix('wb-restday-'),
        load(`wb-history-${y}`), load(`wb-history-${y - 1}`),
        load(K.settings), load(K.travel), load(K.travelAuto), load(K.rest), load(K.goals), load(K.recurring),
        load(K.todos), load(K.cats), load(K.top3), load(K.opens), load(K.grad), load(K.reviewDone), load(K.migrated),
      ])
      if (!alive) return
      setLists(normalizeLists(v2Lists, v1Lists))
      if (v1Lists) {
        const old = ['weekly', 'monthly', 'annual'].flatMap((k) => (Array.isArray(v1Lists[k]) ? v1Lists[k].map((i) => ({ ...i, from: k })) : []))
        setV1Rhythms(old)
      }
      setDayRows(rows || {})
      setHistory({ ...(h0 || {}), ...(h1 || {}) })
      const legacyRest = {}
      Object.keys(restRows || {}).forEach((k) => { const ds = k.replace('wb-restday-', ''); if (isDateStr(ds) && restRows[k]) legacyRest[ds] = 'rest' })
      setRest({ ...legacyRest, ...(rs || {}) })
      const tz = deviceTz()
      const s = { nudgeHour: 20, insightHour: 19, travelKeywords: ['flight', 'travel', 'trip'], dimNames: {}, taggingDone: false, ...(st || {}) }
      setSettings(s)
      if (s.tz !== tz && !isOffline()) save(K.settings, { ...s, tz })
      if (tv) setTravel({ overrides: {}, trips: [], minIds: DEFAULT_TRAVEL_MIN, ...tv })
      if (ta) setTravelAuto(ta)
      if (gl) setGoals(gl)
      if (rc) setRecurring(rc)
      let todoList = Array.isArray(td) ? td : []
      let catList = Array.isArray(ct) && ct.length ? ct : [{ id: 'cat-default', name: 'General', collapsed: false }]
      // One-time: carry v1 quick-capture notes into the to-do list so nothing is lost.
      if (!mig && !isOffline()) {
        const notes = await load('wb-quick-notes-v1')
        if (Array.isArray(notes) && notes.length) {
          const catId = 'cat-notes'
          if (!catList.some((c) => c.id === catId)) catList = [...catList, { id: catId, name: 'Captured notes', collapsed: false }]
          todoList = [...todoList, ...notes.filter((n) => n && n.text).map((n) => ({ id: uid('t'), text: clean(n.text), done: false, categoryId: catId, subitems: [] }))]
          save(K.todos, todoList); save(K.cats, catList)
        }
        save(K.migrated, { at: new Date().toISOString(), notes: true })
      }
      setTodos(todoList); setCats(catList)
      if (t3) setTop3(t3)
      if (ga) setGradAck(ga)
      if (rd) setReviewDone(rd)
      const o = { ...(op || {}) }
      if (!o[localDate()]) {
        o[localDate()] = true
        if (!isOffline()) save(K.opens, o)
      }
      setOpens(o)
      setReady(true)
      refreshSubscription()
    })()
    return () => { alive = false }
  }, [])

  // Notification taps land on ?review=1
  useEffect(() => {
    if (!splashDone) return
    const p = new URLSearchParams(window.location.search)
    if (p.get('review')) { setSheet({ type: 'review' }); window.history.replaceState({}, '', '/') }
  }, [splashDone])

  // ── DERIVED ────────────────────────────────────────────────────────
  const dayStates = useMemo(() => indexDayStates(dayRows), [dayRows])
  const autoSet = useMemo(() => new Set(travelAuto.dates || []), [travelAuto])
  const isTravel = useCallback((ds) => {
    const o = travel.overrides || {}
    if (o[ds] !== undefined) return !!o[ds]
    if ((travel.trips || []).some((t) => ds >= t.start && ds <= (t.end || t.start))) return true
    return autoSet.has(ds)
  }, [travel, autoSet])
  const travelSource = (ds) => {
    const o = travel.overrides || {}
    if (o[ds] !== undefined) return o[ds] ? 'manual' : 'off'
    if ((travel.trips || []).some((t) => ds >= t.start && ds <= (t.end || t.start))) return 'trip'
    return autoSet.has(ds) ? 'calendar' : null
  }
  const ctx = useMemo(() => {
    const c = { lists, dayStates, history, rest, travelMin: travel.minIds, isTravel }
    c.firstDate = firstDataDate(c, today)
    return c
  }, [lists, dayStates, history, rest, travel.minIds, isTravel, today])
  const streak = useMemo(() => computeStreak(ctx, today), [ctx, today])
  const names = settings.dimNames || {}
  const yesterday = addDays(today, -1)
  const activeDs = viewDs || today
  const weekStart = mondayOf(today)
  const pinned = top3.week === weekStart ? top3.ids : []

  // Server reads this to word the evening nudge.
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => save(K.status, {
      date: today, kept: streak.todayKept, protected: streak.todayProtected, remaining: streak.remaining,
      streak: streak.current, repairOpen: streak.repairOpen, at: new Date().toISOString(),
    }), 600)
    return () => clearTimeout(t)
  }, [ready, today, streak.todayKept, streak.todayProtected, streak.remaining, streak.current, streak.repairOpen])

  const statusLine = !ready ? '' :
    streak.todayProtected ? `${streak.todayStatus === 'sick' ? 'Sick day' : 'Rest day'}. Streak protected.` :
    streak.todayKept ? 'Today is kept.' :
    streak.repairOpen ? 'Yesterday is still open. Save it before midnight.' :
    streak.current > 0 ? `Day ${streak.current + 1} is on the line. ${streak.remaining} to go.` :
    `Day one starts with ${streak.remaining} item${streak.remaining === 1 ? '' : 's'}.`

  // ── ACTIONS ────────────────────────────────────────────────────────
  const toggleItem = (ds, item) => {
    if (ds !== today && ds !== yesterday) return
    const mode = isTravel(ds) ? 'travel' : modeFor(ds)
    const key = `cl-${mode}-${ds}`
    const cur = dayRows[key] || {}
    const already = checkedOn(ctx, ds, item.id)
    let next = { ...cur }
    if (already) {
      // Uncheck everywhere it was checked that day.
      const upd = { ...dayRows }
      Object.keys(upd).forEach((k) => {
        if (k.endsWith(`-${ds}`) && k.startsWith('cl-') && upd[k] && upd[k][item.id] && upd[k][item.id].checked) {
          upd[k] = { ...upd[k], [item.id]: { checked: false } }
          save(k, upd[k])
        }
      })
      setDayRows(upd)
      next = upd[key] || next
    } else {
      next[item.id] = { checked: true, at: new Date().toISOString() }
      setDayRows((p) => ({ ...p, [key]: next }))
      save(key, next)
    }
    // Keep v1 history in step so a rollback to v1.12 still reads correctly.
    const shown = shownFor(ctx, ds)
    const done = shown.filter((i) => (i.id === item.id ? !already : checkedOn(ctx, ds, i.id))).length
    const pct = shown.length ? Math.round((done / shown.length) * 100) : 0
    const hk = `wb-history-${ds.slice(0, 4)}`
    setHistory((p) => {
      const nh = { ...p, [ds]: { pts: done, maxPts: shown.length, pct, at: new Date().toISOString(), v2: true } }
      const yearOnly = Object.fromEntries(Object.entries(nh).filter(([d]) => d.startsWith(ds.slice(0, 4))))
      save(hk, yearOnly)
      return nh
    })
  }

  const setRestDay = (ds, kind) => {
    const next = { ...rest }
    if (next[ds] === kind) delete next[ds]; else next[ds] = kind
    setRest(next); save(K.rest, next)
    flash(next[ds] ? `${kind === 'sick' ? 'Sick' : 'Rest'} day set. Streak protected.` : 'Back to a normal day.')
  }

  const saveTravel = (next) => { setTravel(next); save(K.travel, next) }
  const toggleTravelDay = (ds) => {
    const o = { ...(travel.overrides || {}) }
    const on = isTravel(ds)
    o[ds] = !on
    saveTravel({ ...travel, overrides: o })
    flash(!on ? 'Travel day. Three items keep the streak.' : 'Normal rhythm for today.')
  }

  const updateSettings = (patch) => { const n = { ...settings, ...patch }; setSettings(n); save(K.settings, n) }
  const saveLists = (n) => { setLists(n); save(K.lists, n) }
  const saveGoals = (n) => { setGoals(n); save(K.goals, n) }
  const saveRecurring = (n) => { setRecurring(n); save(K.recurring, n) }
  const saveTodos = (n) => { setTodos(n); save(K.todos, n) }
  const saveCats = (n) => { setCats(n); save(K.cats, n) }
  const saveTop3 = (ids) => { const n = { week: weekStart, ids: ids.slice(0, 3) }; setTop3(n); save(K.top3, n) }

  const toggleTodo = (id) => saveTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? today : null } : t)))
  const togglePin = (id) => {
    if (pinned.includes(id)) saveTop3(pinned.filter((x) => x !== id))
    else if (pinned.length >= 3) flash('Top 3 is full. Unpin one first.')
    else saveTop3([...pinned, id])
  }
  const completeRecurring = (id) => {
    saveRecurring(recurring.map((r) => (r.id === id ? complete(r, today) : r)))
    const r = recurring.find((x) => x.id === id)
    if (r) flash(`Done. Next due ${fmtShort(advance(today, r.every, r.unit))}.`)
  }

  // ── INSIGHT ────────────────────────────────────────────────────────
  const insight = useMemo(() => (ready ? buildInsight({ ctx, today, todos, recurring, goals, opens, streak, gradAck }) : null), [ready, ctx, today, todos, recurring, goals, opens, streak, gradAck])
  const sundayReady = ready && modeFor(today) === 'sunday' && reviewDone !== weekStart

  // ── RENDER ─────────────────────────────────────────────────────────
  const openTodos = todos.filter((t) => !t.done)
  const dueToday = recurring.filter((r) => isDue(r, today))
  const datedDue = openTodos.filter((t) => t.due && t.due <= today)
  const activeGoals = goals.filter((g) => g.status !== 'closed')

  return (
    <div className="app">
      {!splashDone && <Splash streak={streak.current} statusLine={statusLine} ready={ready} onDone={() => setSplashDone(true)} />}

      <main className="main" aria-hidden={!splashDone}>
        {tab === 'today' && (
          <TodayView
            ready={ready} today={today} activeDs={activeDs} setViewDs={setViewDs} yesterday={yesterday}
            ctx={ctx} streak={streak} statusLine={statusLine} isTravel={isTravel} travelSource={travelSource}
            toggleItem={toggleItem} rest={rest} setRestDay={setRestDay} toggleTravelDay={toggleTravelDay}
            names={names} pinned={pinned} todos={todos} toggleTodo={toggleTodo}
            dueToday={dueToday} datedDue={datedDue} completeRecurring={completeRecurring}
            activeGoals={activeGoals} goToWeek={() => setTab('week')}
            sundayReady={sundayReady} openReview={() => setSheet({ type: 'review' })}
            openTop3={() => setSheet({ type: 'top3' })}
            needsTagging={ready && !settings.taggingDone} openTagging={() => setSheet({ type: 'tagging' })}
          />
        )}
        {tab === 'todo' && (
          <TodoView todos={todos} cats={cats} saveTodos={saveTodos} saveCats={saveCats} toggleTodo={toggleTodo}
            pinned={pinned} togglePin={togglePin} names={names} today={today}
            recurring={recurring} saveRecurring={saveRecurring} completeRecurring={completeRecurring} v1Rhythms={v1Rhythms} flash={flash} />
        )}
        {tab === 'week' && (
          <WeekView today={today} isTravel={isTravel} travelSource={travelSource} todos={todos} recurring={recurring}
            goals={goals} ctx={ctx} names={names} openGoal={(g) => setSheet({ type: 'goal', goal: g })} streak={streak} />
        )}
        {tab === 'settings' && (
          <SettingsView settings={settings} updateSettings={updateSettings} lists={lists} travel={travel} saveTravel={saveTravel}
            travelAuto={travelAuto} setTravelAuto={setTravelAuto} names={names} sync={sync}
            openEditor={() => setSheet({ type: 'editor' })} openTagging={() => setSheet({ type: 'tagging' })}
            openReview={() => setSheet({ type: 'review' })} flash={flash} />
        )}
        <p className="footer">Meridian v{APP_VERSION}{sync.pending ? `, ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to sync` : ''}{sync.offline ? ', offline' : ''}</p>
      </main>

      <nav className="tabs" aria-label="Main">
        {[['today', 'Today'], ['todo', 'To-Do'], ['week', 'Week'], ['settings', 'Settings']].map(([id, label]) => (
          <button key={id} type="button" className={`tab ${tab === id ? 'on' : ''}`} aria-current={tab === id ? 'page' : undefined}
            onClick={() => { setTab(id); setViewDs(null); window.scrollTo(0, 0) }}>
            <TabIcon id={id} />{label}
          </button>
        ))}
      </nav>

      {sheet && sheet.type === 'review' && insight && (
        <ReviewSheet insight={insight} names={names} lists={lists} saveLists={saveLists} todos={todos} pinned={pinned} saveTop3={saveTop3}
          goals={goals} saveGoals={saveGoals} gradAck={gradAck} setGradAck={(n) => { setGradAck(n); save(K.grad, n) }}
          today={today} onClose={() => setSheet(null)}
          onDone={() => { setReviewDone(weekStart); save(K.reviewDone, weekStart); setSheet(null); flash('Week reviewed. Top 3 pinned to Today.') }} />
      )}
      {sheet && sheet.type === 'top3' && (
        <Sheet title="Top 3 this week" onClose={() => setSheet(null)}>
          <Top3Picker todos={openTodos} pinned={pinned} onChange={saveTop3} names={names} />
        </Sheet>
      )}
      {sheet && sheet.type === 'editor' && <EditorSheet lists={lists} saveLists={saveLists} names={names} onClose={() => setSheet(null)} />}
      {sheet && sheet.type === 'tagging' && (
        <TaggingSheet lists={lists} saveLists={saveLists} todos={todos} saveTodos={saveTodos} recurring={recurring} saveRecurring={saveRecurring}
          names={names} onClose={() => { updateSettings({ taggingDone: true }); setSheet(null) }} />
      )}
      {sheet && sheet.type === 'goal' && (
        <GoalSheet goal={sheet.goal} goals={goals} saveGoals={saveGoals} lists={lists} recurring={recurring} names={names} today={today}
          ctx={ctx} onClose={() => setSheet(null)} flash={flash} />
      )}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// TODAY
// ════════════════════════════════════════════════════════════════════
function TodayView(p) {
  const { ready, today, activeDs, setViewDs, yesterday, ctx, streak, statusLine, isTravel, travelSource, toggleItem, rest, setRestDay,
    toggleTravelDay, names, pinned, todos, toggleTodo, dueToday, datedDue, completeRecurring, activeGoals, goToWeek,
    sundayReady, openReview, openTop3, needsTagging, openTagging } = p
  const [showExtras, setShowExtras] = useState(false)
  const repairing = activeDs !== today
  const travelling = isTravel(activeDs)
  const items = shownFor(ctx, activeDs)
  const core = travelling ? items : items.filter((i) => i.w === 'core')
  const extras = travelling ? [] : items.filter((i) => i.w === 'bonus')
  const doneCore = core.filter((i) => checkedOn(ctx, activeDs, i.id)).length
  const restKind = rest[activeDs]
  const pinnedTodos = pinned.map((id) => todos.find((t) => t.id === id)).filter(Boolean)
  const src = travelSource(activeDs)
  const heroTone = streak.todayKept ? 'kept' : streak.todayProtected ? 'rest' : streak.current > 0 ? 'risk' : 'start'

  return (
    <div className="view">
      <section className={`hero tone-${heroTone}`}>
        <div className="hero-top">
          <p className="hero-date">{fmtLong(today)}</p>
          {isTravel(today) ? <span className="pill travel">Travel day{travelSource(today) === 'calendar' ? ', from calendar' : ''}</span> : null}
        </div>
        <div className="hero-streak">
          {ready ? <>
            <span className="hero-num">{streak.current}</span>
            <span className="hero-unit">{streak.current === 1 ? 'day kept' : 'days kept'}</span>
          </> : <span className="hero-unit loading">Syncing your rhythm</span>}
        </div>
        <p className="hero-status">{statusLine}</p>
        {streak.best > streak.current ? <p className="hero-best">Best run: {streak.best}</p> : null}
        <div className="meridian-line" aria-hidden="true"><span style={{ width: `${core.length ? (doneCore / core.length) * 100 : 0}%` }} /></div>
      </section>

      {streak.repairOpen && !repairing && (
        <button type="button" className="banner warn" onClick={() => setViewDs(yesterday)}>
          <strong>Yesterday is still open.</strong> Finish it before midnight and the streak holds. Open yesterday
        </button>
      )}
      {repairing && (
        <div className="banner">
          <span>Saving {fmtShort(activeDs)}. This window closes at midnight.</span>
          <button type="button" className="btn small" onClick={() => setViewDs(null)}>Back to today</button>
        </div>
      )}
      {needsTagging && !repairing && (
        <button type="button" className="banner" onClick={openTagging}>
          <strong>Tag your rhythm to life dimensions.</strong> Two minutes, once. It powers the Sunday insight.
        </button>
      )}
      {sundayReady && !repairing && (
        <button type="button" className="banner insight" onClick={openReview}>
          <strong>Your week is in.</strong> Slipping, wins and your top 3. About two minutes.
        </button>
      )}

      <section className="card">
        <header className="card-head">
          <h2>{travelling ? 'Travel minimum' : LIST_LABELS[modeFor(activeDs)]}</h2>
          <span className="count">{doneCore} of {core.length}</span>
        </header>
        {travelling && <p className="fine">Three items keep the streak on the road.{src === 'calendar' ? ' Switched on by your calendar.' : ''}</p>}
        {restKind ? <p className="fine">{restKind === 'sick' ? 'Sick day' : 'Rest day'}. Nothing here is required. The streak is protected.</p> : null}
        <div className="checks">
          {core.map((it) => (
            <Check key={it.id} done={checkedOn(ctx, activeDs, it.id)} onClick={() => toggleItem(activeDs, it)}
              label={it.text} sub={it.sub} icon={it.icon} dim={it.dim} names={names} />
          ))}
          {!core.length && <p className="empty">No core items for this day. Add some in Settings, Checklists.</p>}
        </div>
        {extras.length > 0 && (
          <>
            <button type="button" className="link" onClick={() => setShowExtras((v) => !v)} aria-expanded={showExtras}>
              {showExtras ? 'Hide extras' : `Extras (${extras.filter((i) => checkedOn(ctx, activeDs, i.id)).length} of ${extras.length})`}
            </button>
            {showExtras && (
              <div className="checks extras">
                {extras.map((it) => (
                  <Check key={it.id} done={checkedOn(ctx, activeDs, it.id)} onClick={() => toggleItem(activeDs, it)}
                    label={it.text} sub={it.sub} icon={it.icon} dim={it.dim} names={names} />
                ))}
              </div>
            )}
          </>
        )}
        <div className="day-actions">
          <button type="button" className={`chip ${restKind === 'rest' ? 'on' : ''}`} onClick={() => setRestDay(activeDs, 'rest')} aria-pressed={restKind === 'rest'}>Rest day</button>
          <button type="button" className={`chip ${restKind === 'sick' ? 'on' : ''}`} onClick={() => setRestDay(activeDs, 'sick')} aria-pressed={restKind === 'sick'}>Sick day</button>
          <button type="button" className={`chip ${travelling ? 'on' : ''}`} onClick={() => toggleTravelDay(activeDs)} aria-pressed={travelling}>Travel day</button>
        </div>
      </section>

      {!repairing && (
        <>
          <section className="card">
            <header className="card-head">
              <h2>Top 3 this week</h2>
              <button type="button" className="link" onClick={openTop3}>{pinnedTodos.length ? 'Change' : 'Pick'}</button>
            </header>
            {pinnedTodos.length ? (
              <div className="checks">
                {pinnedTodos.map((t) => <Check key={t.id} done={t.done} onClick={() => toggleTodo(t.id)} label={clean(t.text)} icon="★" dim={t.dim} names={names} />)}
              </div>
            ) : <p className="empty">Nothing pinned. Choose the three to-dos that matter most this week.</p>}
          </section>

          {(dueToday.length > 0 || datedDue.length > 0) && (
            <section className="card">
              <header className="card-head"><h2>Due</h2><span className="count">{dueToday.length + datedDue.length}</span></header>
              <div className="checks">
                {dueToday.map((r) => (
                  <Check key={r.id} done={false} onClick={() => completeRecurring(r.id)} label={r.text}
                    sub={`${everyLabel(r)}${isOverdue(r, today) ? `, was due ${fmtShort(r.nextDue)}` : ''}`} icon="↻" dim={r.dim} names={names} />
                ))}
                {datedDue.map((t) => (
                  <Check key={t.id} done={t.done} onClick={() => toggleTodo(t.id)} label={clean(t.text)}
                    sub={t.due < today ? `Was due ${fmtShort(t.due)}` : 'Due today'} icon="◷" dim={t.dim} names={names} />
                ))}
              </div>
            </section>
          )}

          <button type="button" className="goal-line" onClick={goToWeek}>
            {activeGoals.length
              ? <>Quarter goals: {activeGoals.slice(0, 3).map((g) => g.title).join(', ')}{activeGoals.length > 3 ? ` and ${activeGoals.length - 3} more` : ''}</>
              : <>No quarter goals yet. Set 3 to 5 in Week.</>}
          </button>
        </>
      )}
    </div>
  )
}

function Top3Picker({ todos, pinned, onChange, names }) {
  const toggle = (id) => {
    if (pinned.includes(id)) onChange(pinned.filter((x) => x !== id))
    else if (pinned.length < 3) onChange([...pinned, id])
  }
  if (!todos.length) return <p className="empty">Your to-do list is empty. Add a few in To-Do first.</p>
  return (
    <div className="checks">
      <p className="fine">{pinned.length} of 3 pinned. They sit at the top of Today all week.</p>
      {todos.map((t) => (
        <Check key={t.id} done={pinned.includes(t.id)} onClick={() => toggle(t.id)} label={clean(t.text)} icon="★" dim={t.dim} names={names}
          disabled={!pinned.includes(t.id) && pinned.length >= 3} />
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// TO-DO
// ════════════════════════════════════════════════════════════════════
function TodoView({ todos, cats, saveTodos, saveCats, toggleTodo, pinned, togglePin, names, today, recurring, saveRecurring, completeRecurring, v1Rhythms, flash }) {
  const [text, setText] = useState('')
  const [catId, setCatId] = useState(cats[0] ? cats[0].id : 'cat-default')
  const [dim, setDim] = useState('home')
  const [due, setDue] = useState('')
  const [more, setMore] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [rText, setRText] = useState('')
  const [rEvery, setREvery] = useState(1)
  const [rUnit, setRUnit] = useState('month')
  const [rDim, setRDim] = useState('home')
  const [showImport, setShowImport] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [subText, setSubText] = useState('')

  const add = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    saveTodos([...todos, { id: uid('t'), text: text.trim(), done: false, categoryId: catId, subitems: [], dim, due: due || null, createdAt: today }])
    setText(''); setDue('')
  }
  const del = (id) => saveTodos(todos.filter((t) => t.id !== id))
  const addCat = () => { if (!newCat.trim()) return; const c = { id: uid('cat'), name: newCat.trim(), collapsed: false }; saveCats([...cats, c]); setNewCat(''); setCatId(c.id) }
  const toggleCat = (id) => saveCats(cats.map((c) => (c.id === id ? { ...c, collapsed: !c.collapsed } : c)))
  const delCat = (id) => {
    if (id === 'cat-default') return
    saveTodos(todos.map((t) => (t.categoryId === id ? { ...t, categoryId: 'cat-default' } : t)))
    saveCats(cats.filter((c) => c.id !== id))
  }
  const addSub = (tid) => {
    if (!subText.trim()) return
    saveTodos(todos.map((t) => (t.id === tid ? { ...t, subitems: [...(t.subitems || []), { id: uid('st'), text: subText.trim(), done: false }] } : t)))
    setSubText('')
  }
  const toggleSub = (tid, sid) => saveTodos(todos.map((t) => (t.id === tid ? { ...t, subitems: (t.subitems || []).map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) } : t)))
  const setTodoField = (tid, patch) => saveTodos(todos.map((t) => (t.id === tid ? { ...t, ...patch } : t)))

  const addRecurring = (e) => {
    e.preventDefault()
    if (!rText.trim()) return
    saveRecurring([...recurring, { id: uid('r'), text: rText.trim(), every: Number(rEvery) || 1, unit: rUnit, dim: rDim, nextDue: today, history: [] }])
    setRText('')
    flash('Recurring task added. First one is due today.')
  }
  const importRhythm = (it) => {
    const unit = it.from === 'weekly' ? 'week' : it.from === 'monthly' ? 'month' : 'month'
    const every = it.from === 'annual' ? 12 : 1
    saveRecurring([...recurring, { id: uid('r'), text: clean(it.text), every, unit, dim: 'home', nextDue: today, history: [] }])
    flash(`Added: ${clean(it.text)}`)
  }

  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  const catIds = new Set(cats.map((c) => c.id))
  const orphan = open.filter((t) => !catIds.has(t.categoryId))

  const renderRow = (t) => (
    <div key={t.id} className={`todo ${t.done ? 'done' : ''}`}>
      <button type="button" className="todo-box" onClick={() => toggleTodo(t.id)} aria-pressed={t.done} aria-label={t.done ? 'Mark not done' : 'Mark done'}>{t.done ? '✓' : ''}</button>
      <button type="button" className="todo-main" onClick={() => setExpanded(expanded === t.id ? null : t.id)} aria-expanded={expanded === t.id}>
        <span className="todo-text">{clean(t.text)}</span>
        <span className="todo-meta">
          {t.dim ? <><DimDot dim={t.dim} names={names} /> {dimName(t.dim, names)}</> : 'No dimension'}
          {t.due ? <span className={`due ${t.due < today && !t.done ? 'late' : ''}`}>{fmtShort(t.due)}</span> : null}
          {(t.subitems || []).length ? <span>{(t.subitems || []).filter((s) => s.done).length}/{t.subitems.length}</span> : null}
        </span>
      </button>
      {!t.done && <button type="button" className={`pin ${pinned.includes(t.id) ? 'on' : ''}`} onClick={() => togglePin(t.id)} aria-pressed={pinned.includes(t.id)} aria-label="Pin to top 3">★</button>}
      {expanded === t.id && (
        <div className="todo-detail">
          <DimPicker value={t.dim} onChange={(d) => setTodoField(t.id, { dim: d })} names={names} compact />
          <label className="field inline"><span>Due</span><input type="date" value={t.due || ''} onChange={(e) => setTodoField(t.id, { due: e.target.value || null })} /></label>
          {(t.subitems || []).map((s) => (
            <button key={s.id} type="button" className={`sub ${s.done ? 'done' : ''}`} onClick={() => toggleSub(t.id, s.id)}>{s.done ? '✓' : '○'} {clean(s.text)}</button>
          ))}
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); addSub(t.id) }}>
            <input value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="Add a step" aria-label="Add a step" />
            <button type="submit" className="btn small">Add</button>
          </form>
          <button type="button" className="link danger" onClick={() => del(t.id)}>Delete to-do</button>
        </div>
      )}
    </div>
  )

  return (
    <div className="view">
      <h1 className="view-title">To-Do</h1>
      <form className="card add" onSubmit={add}>
        <div className="inline-form">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" aria-label="Add a to-do" />
          <button type="submit" className="btn primary">Add</button>
        </div>
        <button type="button" className="link" onClick={() => setMore((v) => !v)} aria-expanded={more}>{more ? 'Fewer options' : 'List, dimension, due date'}</button>
        {more && (
          <div className="add-more">
            <label className="field"><span>List</span>
              <select value={catId} onChange={(e) => setCatId(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label className="field"><span>Due</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
            <DimPicker value={dim} onChange={setDim} names={names} compact />
          </div>
        )}
      </form>

      {cats.map((c) => {
        const items = open.filter((t) => t.categoryId === c.id || (c.id === 'cat-default' && orphan.includes(t)))
        return (
          <section key={c.id} className="card">
            <header className="card-head">
              <button type="button" className="cat-toggle" onClick={() => toggleCat(c.id)} aria-expanded={!c.collapsed}>
                <h2>{c.name}</h2><span className="count">{items.length}</span>
              </button>
              {c.id !== 'cat-default' && !items.length && <button type="button" className="link danger" onClick={() => delCat(c.id)}>Remove list</button>}
            </header>
            {!c.collapsed && (items.length ? items.map((t) => renderRow(t)) : <p className="empty">Clear.</p>)}
          </section>
        )
      })}
      <div className="inline-form">
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New list name" aria-label="New list name" />
        <button type="button" className="btn" onClick={addCat}>Add list</button>
      </div>

      <section className="card">
        <header className="card-head"><h2>Recurring</h2><span className="count">{recurring.length}</span></header>
        {recurring.length ? recurring.slice().sort((a, b) => (a.nextDue || '').localeCompare(b.nextDue || '')).map((r) => (
          <div key={r.id} className="recur">
            <div className="recur-main">
              <span className="todo-text">{r.text}</span>
              <span className="todo-meta"><DimDot dim={r.dim} names={names} /> {everyLabel(r)}
                <span className={`due ${isOverdue(r, today) ? 'late' : ''}`}>{isDue(r, today) ? (isOverdue(r, today) ? `Overdue since ${fmtShort(r.nextDue)}` : 'Due today') : `Next ${fmtShort(r.nextDue)}`}</span>
              </span>
            </div>
            <button type="button" className="btn small" onClick={() => completeRecurring(r.id)}>Done</button>
            <button type="button" className="icon-btn" aria-label={`Delete ${r.text}`} onClick={() => saveRecurring(recurring.filter((x) => x.id !== r.id))}>✕</button>
          </div>
        )) : <p className="empty">Nothing recurring yet. Furnace filter, car service, school forms.</p>}
        <form className="add-more" onSubmit={addRecurring}>
          <input value={rText} onChange={(e) => setRText(e.target.value)} placeholder="Change furnace filter" aria-label="Recurring task" />
          <div className="field-row">
            <label className="field"><span>Every</span><input type="number" min="1" max="365" value={rEvery} onChange={(e) => setREvery(e.target.value)} /></label>
            <label className="field"><span>Unit</span>
              <select value={rUnit} onChange={(e) => setRUnit(e.target.value)}><option value="day">days</option><option value="week">weeks</option><option value="month">months</option></select>
            </label>
          </div>
          <DimPicker value={rDim} onChange={setRDim} names={names} compact />
          <button type="submit" className="btn">Add recurring task</button>
        </form>
        {v1Rhythms.length > 0 && (
          <>
            <button type="button" className="link" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>{showImport ? 'Hide old rhythms' : 'Bring back an old weekly, monthly or annual rhythm'}</button>
            {showImport && v1Rhythms.map((it) => (
              <div key={`${it.from}-${it.id}`} className="recur">
                <div className="recur-main"><span className="todo-text">{clean(it.text)}</span><span className="todo-meta">Was {it.from}</span></div>
                <button type="button" className="btn small" onClick={() => importRhythm(it)}>Add</button>
              </div>
            ))}
          </>
        )}
      </section>

      {done.length > 0 && (
        <section className="card">
          <button type="button" className="cat-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}><h2>Done</h2><span className="count">{done.length}</span></button>
          {showDone && <>
            {done.map((t) => renderRow(t))}
            <button type="button" className="link danger" onClick={() => saveTodos(open)}>Clear done</button>
          </>}
        </section>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// WEEK
// ════════════════════════════════════════════════════════════════════
function WeekView({ today, isTravel, travelSource, todos, recurring, goals, ctx, names, openGoal, streak }) {
  const days = range(today, addDays(today, 6))
  const q = quarterOf(today)
  const active = goals.filter((g) => g.status !== 'closed')
  return (
    <div className="view">
      <h1 className="view-title">Week</h1>
      <section className="card">
        <header className="card-head"><h2>{q.replace('-', ' ')} goals</h2><span className="count">{active.length} of 5</span></header>
        {active.length ? active.map((g) => {
          const pct = goalProgress(ctx, g, recurring, today)
          return (
            <button key={g.id} type="button" className="goal" onClick={() => openGoal(g)}>
              <span className="goal-top"><DimDot dim={g.dim} names={names} /><span className="goal-title">{g.title}</span><span className="goal-pct">{pct == null ? 'No data' : `${pct}%`}</span></span>
              <span className="bar" aria-hidden="true"><span style={{ width: `${pct || 0}%`, background: dimOf(g.dim).color }} /></span>
              <span className="todo-meta">{(g.itemIds || []).length + (g.recurringIds || []).length} linked {g.quarter !== q ? `, from ${g.quarter}` : ''}</span>
            </button>
          )
        }) : <p className="empty">Goals take their progress from the habits and recurring tasks you link to them. No separate check-ins.</p>}
        {active.length < 5 && <button type="button" className="btn" onClick={() => openGoal(null)}>Add a goal</button>}
      </section>

      <section className="card">
        <header className="card-head"><h2>Next seven days</h2></header>
        {days.map((ds) => {
          const dated = todos.filter((t) => !t.done && t.due === ds)
          const late = ds === today ? todos.filter((t) => !t.done && t.due && t.due < today) : []
          const rec = recurring.filter((r) => r.nextDue === ds || (ds === today && isOverdue(r, today)))
          const tv = isTravel(ds)
          const items = [...late, ...dated]
          return (
            <div key={ds} className={`day ${ds === today ? 'is-today' : ''}`}>
              <div className="day-label"><span className="day-dow">{ds === today ? 'Today' : fmtDay(ds)}</span><span className="day-date">{fmtShort(ds).split(', ').slice(1).join(', ')}</span></div>
              <div className="day-items">
                {tv && <span className="pill travel">Travel{travelSource(ds) === 'calendar' ? ', calendar' : ''}</span>}
                {items.map((t) => <span key={t.id} className="day-item"><DimDot dim={t.dim || 'work'} names={names} />{clean(t.text)}{t.due < ds ? ' (late)' : ''}</span>)}
                {rec.map((r) => <span key={r.id} className="day-item">↻ {r.text}</span>)}
                {!tv && !items.length && !rec.length && <span className="day-empty">Open</span>}
              </div>
            </div>
          )
        })}
      </section>
      <p className="fine center">Best run so far: {streak.best} days.</p>
    </div>
  )
}

function GoalSheet({ goal, goals, saveGoals, lists, recurring, names, today, ctx, onClose, flash }) {
  const isNew = !goal
  const [g, setG] = useState(goal || { id: uid('g'), title: '', dim: 'family', itemIds: [], recurringIds: [], quarter: quarterOf(today), status: 'active' })
  const items = allItems(lists)
  const toggle = (field, id) => setG((x) => ({ ...x, [field]: (x[field] || []).includes(id) ? x[field].filter((i) => i !== id) : [...(x[field] || []), id] }))
  const saveIt = () => {
    if (!g.title.trim()) { flash('Give the goal a name.'); return }
    const active = goals.filter((x) => x.status !== 'closed' && x.id !== g.id)
    if (isNew && active.length >= 5) { flash('Five goals is the limit. Close one first.'); return }
    saveGoals(isNew ? [...goals, { ...g, title: g.title.trim() }] : goals.map((x) => (x.id === g.id ? { ...g, title: g.title.trim() } : x)))
    onClose()
  }
  const pct = goalProgress(ctx, g, recurring, today)
  return (
    <Sheet title={isNew ? 'New goal' : 'Goal'} onClose={onClose} footer={
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={saveIt}>Save goal</button>
        {!isNew && <button type="button" className="btn" onClick={() => { saveGoals(goals.map((x) => (x.id === g.id ? { ...x, status: 'closed', closedAt: today } : x))); onClose() }}>Close goal</button>}
        {!isNew && <button type="button" className="btn ghost danger" onClick={() => { saveGoals(goals.filter((x) => x.id !== g.id)); onClose() }}>Delete</button>}
      </div>}>
      <label className="field"><span>Goal</span><input value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="Lower-body strength twice a week" /></label>
      <DimPicker value={g.dim} onChange={(d) => setG({ ...g, dim: d })} names={names} />
      {!isNew && <p className="fine">Progress this quarter: {pct == null ? 'no data yet' : `${pct}%`}</p>}
      <h3 className="sub-head">Habits that drive it</h3>
      <div className="checks">
        {items.map((it) => <Check key={it.id} done={(g.itemIds || []).includes(it.id)} onClick={() => toggle('itemIds', it.id)} label={it.text} sub={LIST_LABELS[it.list]} icon={it.icon} dim={it.dim} names={names} />)}
      </div>
      {recurring.length > 0 && <>
        <h3 className="sub-head">Recurring tasks that drive it</h3>
        <div className="checks">
          {recurring.map((r) => <Check key={r.id} done={(g.recurringIds || []).includes(r.id)} onClick={() => toggle('recurringIds', r.id)} label={r.text} sub={everyLabel(r)} icon="↻" dim={r.dim} names={names} />)}
        </div>
      </>}
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════════════════
// SUNDAY REVIEW
// ════════════════════════════════════════════════════════════════════
function ReviewSheet({ insight, names, lists, saveLists, todos, pinned, saveTop3, goals, saveGoals, gradAck, setGradAck, today, onClose, onDone }) {
  const [step, setStep] = useState(0)
  const [addText, setAddText] = useState('')
  const [addList, setAddList] = useState('weekday')
  const [dropId, setDropId] = useState('')
  const [replaceFor, setReplaceFor] = useState(null)
  const [replaceText, setReplaceText] = useState('')
  const openTodos = todos.filter((t) => !t.done)
  const staleGoals = insight.goals.filter((g) => g.stale)

  const retire = (id) => {
    const n = {}
    LIST_KEYS.forEach((k) => { n[k] = (lists[k] || []).filter((i) => i.id !== id) })
    saveLists(n)
  }
  const listOf = (id) => LIST_KEYS.find((k) => (lists[k] || []).some((i) => i.id === id)) || 'weekday'
  const addItem = (listKey, text, dim = 'health') => {
    const n = { ...lists, [listKey]: [...(lists[listKey] || []), { id: uid('i'), text, sub: '', icon: '•', w: 'core', dim, addedAt: today }] }
    saveLists(n)
  }
  const steps = ['Your week', 'On autopilot', 'Adjust one habit', 'Top 3']
  const I = insight

  return (
    <Sheet title="Sunday review" onClose={onClose} footer={
      <div className="btn-row">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < steps.length - 1
          ? <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>Next: {steps[step + 1]}</button>
          : <button type="button" className="btn primary" onClick={onDone}>Finish review</button>}
        {step < steps.length - 1 && <button type="button" className="link" onClick={() => setStep(step + 1)}>Skip</button>}
      </div>}>
      <ol className="steps" aria-label="Review steps">
        {steps.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'past' : ''}>{s}</li>)}
      </ol>

      {step === 0 && (
        <div className="insight">
          <div className="insight-hero">
            <span className="hero-num small">{I.streak}</span><span className="hero-unit">{I.streak === 1 ? 'day kept' : 'days kept'}</span>
            <p className="fine">Opened Meridian {I.opensThisWeek} of {I.daysInWeek} days this week.</p>
          </div>
          {!I.hasData ? <p className="empty">Not enough logged this week to say anything specific yet. Check back next Sunday.</p> : <>
            <h3 className="sub-head">Slipping</h3>
            {I.slipping.length ? I.slipping.map((s) => (
              <p key={s.id} className="insight-row"><DimDot dim={s.dim} names={names} /><span><strong>{s.text}</strong> fell to {s.now}% from {s.before}% over the previous four weeks.</span></p>
            )) : <p className="fine">Nothing dropped meaningfully against the last four weeks.</p>}
            <h3 className="sub-head">Holding strong</h3>
            {I.wins.length ? I.wins.map((w) => (
              <p key={w.id} className="insight-row"><DimDot dim={w.dim} names={names} /><span><strong>{w.text}</strong> at {w.now}%.</span></p>
            )) : <p className="fine">No habit cleared 90% this week.</p>}
            <h3 className="sub-head">Untouched this week</h3>
            {I.neglected.length ? <p className="insight-row"><span>{I.neglected.map((d) => dimName(d, names)).join(', ')} had nothing completed. Is that a choice, or did the week take it?</span></p>
              : <p className="fine">Every dimension got at least one completion.</p>}
          </>}
          {I.goals.length > 0 && <>
            <h3 className="sub-head">Quarter goals</h3>
            {I.goals.map((g) => (
              <div key={g.id} className="goal static">
                <span className="goal-top"><DimDot dim={g.dim} names={names} /><span className="goal-title">{g.title}</span><span className="goal-pct">{g.pct == null ? 'No data' : `${g.pct}%`}</span></span>
                <span className="bar" aria-hidden="true"><span style={{ width: `${g.pct || 0}%`, background: dimOf(g.dim).color }} /></span>
              </div>
            ))}
          </>}
          {staleGoals.length > 0 && <>
            <h3 className="sub-head">Last quarter's goals</h3>
            {staleGoals.map((g) => (
              <div key={g.id} className="recur">
                <div className="recur-main"><span className="todo-text">{g.title}</span><span className="todo-meta">{g.quarter}, ended at {g.pct ?? 0}%</span></div>
                <button type="button" className="btn small" onClick={() => saveGoals(goals.map((x) => (x.id === g.id ? { ...x, status: 'closed', closedAt: today } : x)))}>Close</button>
                <button type="button" className="btn small" onClick={() => saveGoals(goals.map((x) => (x.id === g.id ? { ...x, quarter: quarterOf(today) } : x)))}>Carry over</button>
              </div>
            ))}
            <p className="fine">To replace one, close it here and add the new goal in Week.</p>
          </>}
        </div>
      )}

      {step === 1 && (
        <div>
          {I.graduation.length ? <>
            <p className="fine">These have been done every single day they were due for eight weeks straight. Keep them, retire them, or swap in something harder.</p>
            {I.graduation.map((g) => (
              <div key={g.id} className="grad">
                <p className="insight-row"><DimDot dim={g.dim} names={names} /><strong>{g.text}</strong></p>
                <div className="btn-row">
                  <button type="button" className="btn small" onClick={() => setGradAck({ ...gradAck, [g.id]: today })}>Keep</button>
                  <button type="button" className="btn small" onClick={() => { retire(g.id); setGradAck({ ...gradAck, [g.id]: today }) }}>Retire</button>
                  <button type="button" className="btn small" onClick={() => setReplaceFor(g)}>Replace</button>
                </div>
                {replaceFor && replaceFor.id === g.id && (
                  <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (!replaceText.trim()) return; const lk = listOf(g.id); retire(g.id); addItem(lk, replaceText.trim(), g.dim); setGradAck({ ...gradAck, [g.id]: today }); setReplaceFor(null); setReplaceText('') }}>
                    <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="The harder version" aria-label="Replacement habit" />
                    <button type="submit" className="btn small primary">Swap</button>
                  </form>
                )}
              </div>
            ))}
          </> : <p className="empty">Nothing has been perfect for eight straight weeks yet. When something is, it shows up here to retire or level up.</p>}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="fine">Optional. One change at most, so the rhythm stays something you can hold.</p>
          <h3 className="sub-head">Add one habit</h3>
          <form className="add-more" onSubmit={(e) => { e.preventDefault(); if (!addText.trim()) return; addItem(addList, addText.trim()); setAddText(''); }}>
            <input value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="New habit" aria-label="New habit" />
            <label className="field"><span>Goes on</span>
              <select value={addList} onChange={(e) => setAddList(e.target.value)}>{LIST_KEYS.map((k) => <option key={k} value={k}>{LIST_LABELS[k]}</option>)}</select>
            </label>
            <button type="submit" className="btn">Add habit</button>
          </form>
          <h3 className="sub-head">Drop one habit</h3>
          <div className="inline-form">
            <select value={dropId} onChange={(e) => setDropId(e.target.value)} aria-label="Habit to drop">
              <option value="">Choose a habit</option>
              {allItems(lists).map((it) => <option key={it.id} value={it.id}>{it.text} ({LIST_LABELS[it.list]})</option>)}
            </select>
            <button type="button" className="btn" disabled={!dropId} onClick={() => { retire(dropId); setDropId('') }}>Drop</button>
          </div>
        </div>
      )}

      {step === 3 && <Top3Picker todos={openTodos} pinned={pinned} onChange={saveTop3} names={names} />}
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════
function SettingsView({ settings, updateSettings, lists, travel, saveTravel, travelAuto, setTravelAuto, names, sync, openEditor, openTagging, openReview, flash }) {
  const [tripStart, setTripStart] = useState('')
  const [tripEnd, setTripEnd] = useState('')
  const [tripLabel, setTripLabel] = useState('')
  const [kw, setKw] = useState((settings.travelKeywords || []).join(', '))
  const [syncing, setSyncing] = useState(false)
  const [legacy, setLegacy] = useState(null) // null | {keys} | 'confirm' | 'done'
  const [legacyBusy, setLegacyBusy] = useState(false)
  const [pickMin, setPickMin] = useState(false)
  const all = allItems(lists)
  const minIds = travel.minIds || []
  const toggleMin = (id) => {
    if (minIds.includes(id)) saveTravel({ ...travel, minIds: minIds.filter((x) => x !== id) })
    else if (minIds.length >= 3) flash('Three is the minimum day. Remove one first.')
    else saveTravel({ ...travel, minIds: [...minIds, id] })
  }
  const addTrip = (e) => {
    e.preventDefault()
    if (!tripStart) return
    saveTravel({ ...travel, trips: [...(travel.trips || []), { id: uid('trip'), start: tripStart, end: tripEnd || tripStart, label: tripLabel.trim() }] })
    setTripStart(''); setTripEnd(''); setTripLabel('')
  }
  const syncNow = async () => {
    setSyncing(true)
    try {
      const r = await fetch('/.netlify/functions/push-test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'travel-sync' }) })
      const j = await r.json()
      setTravelAuto(j)
      flash(j.error ? j.error : `Calendar read. ${(j.dates || []).length} travel days found.`)
    } catch (e) { flash('Could not reach the sync service.') }
    setSyncing(false)
  }
  const findLegacy = async () => {
    setLegacyBusy(true)
    try { const keys = (await listKeys()).filter((k) => LEGACY_PATTERNS.some((re) => re.test(k))); setLegacy({ keys }) }
    catch (e) { flash('Could not list stored data. Try again online.') }
    setLegacyBusy(false)
  }
  const deleteLegacy = async () => {
    setLegacyBusy(true)
    try { await removeKeys(legacy.keys); setLegacy('done'); flash('Legacy data deleted.') }
    catch (e) { flash('Delete failed: ' + e.message) }
    setLegacyBusy(false)
  }
  const upcomingAuto = (travelAuto.dates || []).filter((d) => d >= localDate()).slice(0, 60)

  return (
    <div className="view">
      <h1 className="view-title">Settings</h1>

      <section className="card">
        <header className="card-head"><h2>Reminders</h2></header>
        <RemindersPanel settings={settings} onSettings={updateSettings} />
      </section>

      <section className="card">
        <header className="card-head"><h2>Travel</h2></header>
        <h3 className="sub-head">Minimum day ({minIds.length} of 3)</h3>
        <p className="fine">On a travel day, these three keep the streak.</p>
        <div className="checks">
          {(pickMin ? all : all.filter((it) => minIds.includes(it.id))).map((it) => <Check key={it.id} done={minIds.includes(it.id)} onClick={() => toggleMin(it.id)} label={it.text} sub={LIST_LABELS[it.list]} icon={it.icon} dim={it.dim} names={names}
            disabled={!minIds.includes(it.id) && minIds.length >= 3} />)}
        </div>
        <button type="button" className="link" onClick={() => setPickMin((v) => !v)} aria-expanded={pickMin}>{pickMin ? 'Done choosing' : 'Change the three'}</button>

        <h3 className="sub-head">Trips</h3>
        {(travel.trips || []).filter((t) => (t.end || t.start) >= localDate()).map((t) => (
          <div key={t.id} className="recur">
            <div className="recur-main"><span className="todo-text">{t.label || 'Trip'}</span><span className="todo-meta">{fmtShort(t.start)}{t.end && t.end !== t.start ? ` to ${fmtShort(t.end)}` : ''}</span></div>
            <button type="button" className="icon-btn" aria-label="Delete trip" onClick={() => saveTravel({ ...travel, trips: travel.trips.filter((x) => x.id !== t.id) })}>✕</button>
          </div>
        ))}
        <form className="add-more" onSubmit={addTrip}>
          <input value={tripLabel} onChange={(e) => setTripLabel(e.target.value)} placeholder="Where to" aria-label="Trip name" />
          <div className="field-row">
            <label className="field"><span>From</span><input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} /></label>
          </div>
          <button type="submit" className="btn">Add trip</button>
        </form>

        <h3 className="sub-head">From your iCloud calendar</h3>
        <p className="fine">Share a calendar publicly in the Calendar app, copy its link, and add it in Netlify as the ICS_URL environment variable. Events whose titles contain these words become travel days. Use * to treat every event on that calendar as travel.</p>
        <div className="inline-form">
          <input value={kw} onChange={(e) => setKw(e.target.value)} aria-label="Travel keywords" placeholder="flight, travel, trip" />
          <button type="button" className="btn" onClick={() => { updateSettings({ travelKeywords: kw.split(',').map((s) => s.trim()).filter(Boolean) }); flash('Keywords saved. Sync to apply.') }}>Save</button>
        </div>
        <p className="fine">
          {travelAuto.syncedAt ? `Last read ${new Date(travelAuto.syncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. ` : 'Not read yet. '}
          {travelAuto.error ? travelAuto.error : upcomingAuto.length ? `Upcoming travel days: ${upcomingAuto.slice(0, 8).map(fmtShort).join(', ')}${upcomingAuto.length > 8 ? ` and ${upcomingAuto.length - 8} more` : ''}.` : travelAuto.syncedAt ? 'No upcoming travel found.' : ''}
        </p>
        <button type="button" className="btn" onClick={syncNow} disabled={syncing}>{syncing ? 'Reading calendar' : 'Sync calendar now'}</button>
        <p className="fine">The Travel day button on Today always wins over the calendar.</p>
      </section>

      <section className="card">
        <header className="card-head"><h2>Rhythm and dimensions</h2></header>
        <div className="btn-row">
          <button type="button" className="btn" onClick={openEditor}>Edit checklists</button>
          <button type="button" className="btn" onClick={openTagging}>Tag dimensions</button>
          <button type="button" className="btn" onClick={openReview}>Open weekly review</button>
        </div>
        <h3 className="sub-head">Dimension names</h3>
        {DIMENSIONS.map((d) => (
          <label key={d.id} className="field inline"><DimDot dim={d.id} names={names} />
            <input value={names[d.id] ?? d.name} onChange={(e) => updateSettings({ dimNames: { ...names, [d.id]: e.target.value } })} aria-label={`Name for ${d.name}`} />
          </label>
        ))}
      </section>

      <section className="card">
        <header className="card-head"><h2>Data</h2></header>
        <p className="fine">{sync.offline ? 'Offline. Changes are saved on this phone and will sync when you reconnect.' : sync.pending ? `${sync.pending} changes waiting to sync.` : 'Everything is synced.'}</p>
        <p className="fine">v2 no longer uses XP, levels, Journey, Journal, the old goals and arcs, Progress, Platform, or the weekly, monthly and annual checklists. That data is still stored so you can roll back to v1.12. Delete it once you are sure.</p>
        {legacy === null && <button type="button" className="btn" onClick={findLegacy} disabled={legacyBusy}>{legacyBusy ? 'Looking' : 'Find legacy data'}</button>}
        {legacy && legacy.keys && (legacy.keys.length
          ? <div className="btn-row"><span className="fine">{legacy.keys.length} stored records from removed features.</span>
              <button type="button" className="btn danger" onClick={() => setLegacy({ ...legacy, confirm: true })} disabled={legacyBusy}>Delete legacy data</button></div>
          : <p className="fine">No legacy data found.</p>)}
        {legacy && legacy.confirm && (
          <div className="banner warn">
            <span>This removes them for good, and v1.12 will no longer have them. Your checklist history, to-dos and streak are kept.</span>
            <button type="button" className="btn danger" onClick={deleteLegacy} disabled={legacyBusy}>{legacyBusy ? 'Deleting' : 'Delete permanently'}</button>
          </div>
        )}
        {legacy === 'done' && <p className="fine">Legacy data deleted.</p>}
      </section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// CHECKLIST EDITOR
// ════════════════════════════════════════════════════════════════════
function EditorSheet({ lists, saveLists, names, onClose }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(lists)))
  const [which, setWhich] = useState('weekday')
  const items = draft[which] || []
  const upd = (id, patch) => setDraft({ ...draft, [which]: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const move = (idx, dir) => {
    const arr = [...items]; const j = idx + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    setDraft({ ...draft, [which]: arr })
  }
  return (
    <Sheet title="Checklists" onClose={onClose} footer={
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => { saveLists(draft); onClose() }}>Save checklists</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      </div>}>
      <div className="seg" role="tablist">
        {LIST_KEYS.map((k) => <button key={k} type="button" role="tab" aria-selected={which === k} className={which === k ? 'on' : ''} onClick={() => setWhich(k)}>{LIST_LABELS[k].replace(' rhythm', '')}</button>)}
      </div>
      {which === 'travel' && <p className="fine">The travel minimum (3 items) is picked in Settings, Travel. This list feeds that picker.</p>}
      {items.map((it, idx) => (
        <div key={it.id} className="edit-item">
          <div className="inline-form">
            <input className="emoji" value={it.icon} onChange={(e) => upd(it.id, { icon: e.target.value })} aria-label="Icon" />
            <input value={it.text} onChange={(e) => upd(it.id, { text: e.target.value })} aria-label="Habit" />
          </div>
          <input value={it.sub} onChange={(e) => upd(it.id, { sub: e.target.value })} placeholder="Why it matters" aria-label="Note" />
          <div className="btn-row">
            <button type="button" className={`chip ${it.w === 'core' ? 'on' : ''}`} onClick={() => upd(it.id, it.w === 'core' ? { w: 'bonus' } : { w: 'core', addedAt: localDate() })} aria-pressed={it.w === 'core'}>
              {it.w === 'core' ? 'Required' : 'Extra'}
            </button>
            <button type="button" className="icon-btn" onClick={() => move(idx, -1)} aria-label="Move up">↑</button>
            <button type="button" className="icon-btn" onClick={() => move(idx, 1)} aria-label="Move down">↓</button>
            <button type="button" className="link danger" onClick={() => setDraft({ ...draft, [which]: items.filter((i) => i.id !== it.id) })}>Remove</button>
          </div>
          <DimPicker value={it.dim} onChange={(d) => upd(it.id, { dim: d })} names={names} compact />
        </div>
      ))}
      <button type="button" className="btn" onClick={() => setDraft({ ...draft, [which]: [...items, { id: uid('i'), text: 'New habit', sub: '', icon: '•', w: 'core', dim: 'health', addedAt: localDate() }] })}>Add habit</button>
      <p className="fine">Required items decide whether the day is kept. Extras are optional.</p>
    </Sheet>
  )
}

function TaggingSheet({ lists, saveLists, todos, saveTodos, recurring, saveRecurring, names, onClose }) {
  const items = allItems(lists)
  const open = todos.filter((t) => !t.done)
  const setItemDim = (id, dim) => {
    const n = {}
    LIST_KEYS.forEach((k) => { n[k] = (lists[k] || []).map((i) => (i.id === id ? { ...i, dim } : i)) })
    saveLists(n)
  }
  return (
    <Sheet title="Tag dimensions" onClose={onClose} footer={<button type="button" className="btn primary" onClick={onClose}>Done</button>}>
      <p className="fine">Every habit and to-do belongs to one part of life. Tags are pre-filled from v1 categories; fix any that are wrong. This is what lets Sunday say which part of life went untouched.</p>
      <h3 className="sub-head">Habits</h3>
      {items.map((it) => (
        <div key={it.id} className="tag-row">
          <p className="tag-label">{it.icon} {it.text}</p>
          <DimPicker value={it.dim} onChange={(d) => setItemDim(it.id, d)} names={names} compact />
        </div>
      ))}
      {open.length > 0 && <h3 className="sub-head">Open to-dos</h3>}
      {open.map((t) => (
        <div key={t.id} className="tag-row">
          <p className="tag-label">{clean(t.text)}</p>
          <DimPicker value={t.dim} onChange={(d) => saveTodos(todos.map((x) => (x.id === t.id ? { ...x, dim: d } : x)))} names={names} compact />
        </div>
      ))}
      {recurring.length > 0 && <h3 className="sub-head">Recurring</h3>}
      {recurring.map((r) => (
        <div key={r.id} className="tag-row">
          <p className="tag-label">↻ {r.text}</p>
          <DimPicker value={r.dim} onChange={(d) => saveRecurring(recurring.map((x) => (x.id === r.id ? { ...x, dim: d } : x)))} names={names} compact />
        </div>
      ))}
    </Sheet>
  )
}
