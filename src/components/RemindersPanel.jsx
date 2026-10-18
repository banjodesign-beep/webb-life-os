// src/components/RemindersPanel.jsx
// Turn reminders on, prove they work, and see exactly where they break.
import React, { useEffect, useState } from 'react'
import { pushEnv, enablePush, sendTest, serverStatus, currentSubscription } from '../lib/push.js'

function Row({ ok, label, detail }) {
  const mark = ok === true ? '✓' : ok === false ? '✕' : '…'
  return (
    <li className={`diag-row ${ok === true ? 'ok' : ok === false ? 'bad' : ''}`}>
      <span className="diag-mark" aria-hidden="true">{mark}</span>
      <span className="diag-label">{label}</span>
      {detail ? <span className="diag-detail">{detail}</span> : null}
    </li>
  )
}

function fmt(iso) { try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return iso } }

export default function RemindersPanel({ settings, onSettings }) {
  const [env, setEnv] = useState(pushEnv())
  const [hasSub, setHasSub] = useState(null)
  const [server, setServer] = useState(null)
  const [serverErr, setServerErr] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const refresh = async () => {
    setEnv(pushEnv())
    try { setHasSub(!!(await currentSubscription())) } catch { setHasSub(false) }
    try { setServer(await serverStatus()); setServerErr('') } catch (e) { setServerErr(e.message) }
  }
  useEffect(() => { refresh() }, [])

  const turnOn = async () => {
    setBusy('on'); setMsg('')
    try { await enablePush(); setMsg('Reminders are on. Now send a test.') } catch (e) { setMsg(e.message) }
    setBusy(''); refresh()
  }
  const test = async () => {
    setBusy('test'); setMsg('')
    const r = await sendTest()
    setMsg(r.ok ? 'Sent. It should land on your phone within a few seconds. Lock the screen if it does not show while Meridian is open.' : `Not sent: ${r.error || 'unknown error'}${r.status ? ` (status ${r.status})` : ''}`)
    setBusy(''); refresh()
  }

  const keyOk = server ? !server.keyError : null
  const subSaved = server && server.subscription ? server.subscription.saved : null
  const lastRuns = (server && server.runs) || []
  const lastNudge = lastRuns.find((r) => r.kind === 'nudge' || r.kind === 'insight' || r.kind === 'test')
  const anyRun = lastRuns.find((r) => r.kind !== 'test')

  return (
    <div className="panel">
      <ul className="diag">
        <Row ok={env.supported} label="This device supports reminders" detail={!env.supported && env.ios ? 'Needs iOS 16.4 or later' : ''} />
        <Row ok={env.ios ? env.standalone : true} label="Opened from the home screen icon" detail={env.ios && !env.standalone ? 'Safari tabs cannot get reminders on iPhone' : ''} />
        <Row ok={env.permission === 'granted' ? true : env.permission === 'denied' ? false : null} label="Notification permission" detail={env.permission} />
        <Row ok={hasSub} label="Phone is subscribed" />
        <Row ok={serverErr ? false : keyOk} label="Reminder service and key" detail={serverErr || (server && server.keyError) || (server && server.envPublicMismatch ? 'VAPID_PUBLIC_KEY env var disagrees with the private key; the derived key is used' : '')} />
        <Row ok={subSaved} label="Subscription saved on the server" detail={server && server.subscription && server.subscription.keyMatches === false ? 'Saved with an old key. Tap Turn on reminders.' : ''} />
        <Row ok={anyRun ? true : null} label="Hourly scheduler has run" detail={anyRun ? `Last: ${anyRun.kind}, ${fmt(anyRun.at)}` : 'No runs logged yet. Allow up to an hour after deploy.'} />
        {lastNudge ? <Row ok={!!lastNudge.ok} label={`Last ${lastNudge.kind}`} detail={`${fmt(lastNudge.at)}${lastNudge.ok ? '' : `: ${lastNudge.error || ''}`}${lastNudge.skipped ? `: skipped, ${lastNudge.skipped}` : ''}`} /> : null}
      </ul>

      <div className="btn-row">
        <button type="button" className="btn primary" onClick={turnOn} disabled={!!busy}>{busy === 'on' ? 'Turning on' : hasSub ? 'Re-register this phone' : 'Turn on reminders'}</button>
        <button type="button" className="btn" onClick={test} disabled={!!busy}>{busy === 'test' ? 'Sending' : 'Send test notification'}</button>
        <button type="button" className="btn ghost" onClick={refresh} disabled={!!busy}>Refresh</button>
      </div>
      {msg ? <p className="note" role="status">{msg}</p> : null}

      <div className="field-row">
        <label className="field">
          <span>Evening nudge</span>
          <select value={settings.nudgeHour ?? 20} onChange={(e) => onSettings({ nudgeHour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Sunday insight</span>
          <select value={settings.insightHour ?? 19} onChange={(e) => onSettings({ insightHour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}</option>)}
          </select>
        </label>
      </div>
      <p className="fine">Times follow your phone's timezone ({settings.tz || 'unknown'}), so they move with you when you travel. The nudge is skipped on days you have already kept.</p>
    </div>
  )
}
