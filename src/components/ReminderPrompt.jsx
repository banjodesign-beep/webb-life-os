// src/components/ReminderPrompt.jsx  (v1.13, push fix only)
// A pill at the bottom of the screen that stays until a test notification
// has actually reached the phone. Tapping it opens a small checklist that
// shows exactly which link in the chain is broken.
// Lives outside App.jsx so App.jsx needs no edits.
import { useEffect, useState } from 'react'
import { pushEnv, enablePush, sendTest, serverStatus, currentSubscription, refreshSubscription } from '../lib/push.js'

const DONE_KEY = 'meridian-push-verified'

const C = {
  ink: '#E8F3F1', muted: '#8FA4AC', ok: '#7FE7D6', bad: '#F09A84', bg: '#0B2633', btn: '#2B5F7D', line: 'rgba(232,243,241,0.12)',
}

function Line({ ok, label, detail }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: '0 8px', padding: '5px 0', fontSize: 14 }}>
      <span style={{ fontWeight: 800, color: ok === true ? C.ok : ok === false ? C.bad : C.muted }}>{ok === true ? '✓' : ok === false ? '✕' : '…'}</span>
      <span>{label}</span>
      {detail ? <span style={{ gridColumn: 2, fontSize: 12.5, color: C.muted, wordBreak: 'break-word' }}>{detail}</span> : null}
    </div>
  )
}

const btn = (primary) => ({
  background: primary ? C.btn : 'transparent', color: C.ink, border: `1px solid ${primary ? C.btn : C.line}`,
  borderRadius: 999, padding: '9px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
})

export default function ReminderPrompt() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DONE_KEY) === '1' } catch { return false } })
  const [open, setOpen] = useState(false)
  const [env, setEnv] = useState(pushEnv())
  const [hasSub, setHasSub] = useState(null)
  const [server, setServer] = useState(null)
  const [serverErr, setServerErr] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  const refresh = async () => {
    setEnv(pushEnv())
    try { setHasSub(!!(await currentSubscription())) } catch { setHasSub(false) }
    try { setServer(await serverStatus()); setServerErr('') } catch (e) { setServerErr(e.message) }
  }
  useEffect(() => { refreshSubscription(); if (!hidden) refresh() }, [])

  if (hidden) return null

  const turnOn = async () => {
    setBusy('on'); setMsg('')
    try { await enablePush(); setMsg('Reminders are on. Now send a test.') } catch (e) { setMsg(e.message) }
    setBusy(''); refresh()
  }
  const test = async () => {
    setBusy('test'); setMsg('')
    const r = await sendTest()
    if (r.ok) { setSent(true); setMsg('Sent. Lock your phone: it should arrive within a few seconds.') }
    else setMsg(`Not sent: ${r.error || 'unknown error'}${r.status ? ` (status ${r.status})` : ''}`)
    setBusy(''); refresh()
  }
  const worked = () => { try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignore */ } setHidden(true) }

  const runs = (server && server.runs) || []
  const sched = runs.find((r) => r.kind !== 'test')
  const keyOk = server ? !server.keyError : null

  if (!open) {
    return (
      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <button type="button" onClick={() => setOpen(true)} style={{ pointerEvents: 'auto', background: '#10171C', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(7,16,19,0.3)', cursor: 'pointer' }}>
          🔔 Set up and test reminders
        </button>
      </div>
    )
  }

  return (
    <div role="dialog" aria-label="Reminders" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(6,26,38,0.55)' }}>
      <div style={{ width: '100%', maxWidth: 560, background: C.bg, color: C.ink, borderRadius: '22px 22px 0 0', padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', maxHeight: '90vh', overflowY: 'auto', fontFamily: '-apple-system, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 18 }}>Reminders</strong>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <Line ok={env.supported} label="This device supports reminders" detail={!env.supported && env.ios ? 'Needs iOS 16.4 or later' : ''} />
        <Line ok={env.ios ? env.standalone : true} label="Opened from the home screen icon" detail={env.ios && !env.standalone ? 'Safari tabs cannot get reminders on iPhone' : ''} />
        <Line ok={env.permission === 'granted' ? true : env.permission === 'denied' ? false : null} label="Notification permission" detail={env.permission} />
        <Line ok={hasSub} label="Phone is subscribed" />
        <Line ok={serverErr ? false : keyOk} label="Reminder service and key" detail={serverErr || (server && server.keyError) || ''} />
        <Line ok={server && server.subscription ? server.subscription.saved : null} label="Subscription saved on the server"
          detail={server && server.subscription && server.subscription.keyMatches === false ? 'Saved with an old key. Tap Turn on reminders.' : ''} />
        <Line ok={sched ? true : null} label="Hourly scheduler has run" detail={sched ? `Last: ${sched.kind} at ${new Date(sched.at).toLocaleString()}${sched.ok === false ? `: ${sched.error || ''}` : ''}` : 'No runs logged yet. Allow up to an hour after deploy.'} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button type="button" style={btn(true)} onClick={turnOn} disabled={!!busy}>{busy === 'on' ? 'Turning on' : hasSub ? 'Re-register this phone' : 'Turn on reminders'}</button>
          <button type="button" style={btn(false)} onClick={test} disabled={!!busy}>{busy === 'test' ? 'Sending' : 'Send test notification'}</button>
          <button type="button" style={btn(false)} onClick={refresh} disabled={!!busy}>Refresh</button>
        </div>
        {msg ? <p style={{ fontSize: 14, marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(232,243,241,0.06)' }}>{msg}</p> : null}
        {sent ? <button type="button" style={{ ...btn(true), marginTop: 10, width: '100%', background: '#2F7A5B', borderColor: '#2F7A5B' }} onClick={worked}>It arrived. Hide this.</button> : null}
      </div>
    </div>
  )
}
