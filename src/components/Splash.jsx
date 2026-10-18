// src/components/Splash.jsx
// The v2 intro. A wireframe globe turns in deep water; one meridian catches
// the light, locks to centre and becomes the line the whole day hangs on.
// Then the streak counts up. Tap anywhere to skip. Reduced motion gets a
// still frame.
import React, { useEffect, useRef, useState } from 'react'

const R = 112          // globe radius in SVG units
const MERIDIANS = 12   // lines of longitude
const PARALLELS = [-60, -30, 0, 30, 60]

function tzMeridian() {
  const off = -new Date().getTimezoneOffset() / 60 // hours east of UTC
  const deg = Math.round(Math.abs(off) * 15)
  if (deg === 0) return 'Prime meridian, 0°'
  return `${deg}° ${off < 0 ? 'W' : 'E'} meridian`
}

function useReducedMotion() {
  const [r, setR] = useState(false)
  useEffect(() => {
    try { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setR(m.matches) } catch { /* ignore */ }
  }, [])
  return r
}

function Particles({ still }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    let w = 0, h = 0, raf = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    resize()
    const dots = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.3,
      v: Math.random() * 0.25 + 0.05, a: Math.random() * 0.5 + 0.15, p: Math.random() * Math.PI * 2,
    }))
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h)
      dots.forEach((d) => {
        if (!still) { d.y -= d.v; if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w } }
        const tw = still ? 1 : 0.6 + 0.4 * Math.sin(t / 900 + d.p)
        ctx.beginPath()
        ctx.fillStyle = `rgba(127,231,214,${d.a * tw})`
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fill()
      })
      if (!still) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [still])
  return <canvas ref={ref} className="sp-particles" aria-hidden="true" />
}

function Globe({ phase, still }) {
  const linesRef = useRef([])
  const heroRef = useRef(null)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      const t = still ? 2600 : now - start
      const spin = t / 2600 * Math.PI // half a turn over the intro
      linesRef.current.forEach((el, i) => {
        if (!el) return
        const th = (i / MERIDIANS) * Math.PI + spin
        const rx = Math.abs(Math.cos(th)) * R
        const front = Math.sin(th) > 0
        el.setAttribute('rx', rx.toFixed(2))
        el.setAttribute('stroke-opacity', front ? '0.55' : '0.16')
      })
      // The hero meridian eases from the edge to dead centre, then locks.
      const k = Math.min(1, Math.max(0, (t - 500) / 1100))
      const ease = 1 - Math.pow(1 - k, 3)
      if (heroRef.current) heroRef.current.setAttribute('rx', Math.max(0.8, R * (1 - ease)).toFixed(2))
      if (!still && t < 4200) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [still])

  return (
    <svg className={`sp-globe ${phase >= 1 ? 'on' : ''}`} viewBox="-140 -140 280 280" aria-hidden="true">
      <defs>
        <radialGradient id="spSea" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#14506A" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#0A2A3A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#061A26" stopOpacity="0" />
        </radialGradient>
        <filter id="spGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle r={R} fill="url(#spSea)" />
      <circle r={R} fill="none" stroke="#7FE7D6" strokeOpacity="0.5" strokeWidth="0.9" />
      {PARALLELS.map((lat) => {
        const rad = (lat * Math.PI) / 180
        return <ellipse key={lat} cx="0" cy={(-Math.sin(rad) * R).toFixed(2)} rx={(Math.cos(rad) * R).toFixed(2)} ry={(Math.cos(rad) * R * 0.16).toFixed(2)}
          fill="none" stroke="#7FE7D6" strokeOpacity={lat === 0 ? 0.45 : 0.2} strokeWidth="0.7" />
      })}
      {Array.from({ length: MERIDIANS }, (_, i) => (
        <ellipse key={i} ref={(el) => { linesRef.current[i] = el }} cx="0" cy="0" rx={R} ry={R} fill="none" stroke="#7FE7D6" strokeWidth="0.7" />
      ))}
      <ellipse ref={heroRef} className="sp-hero-line" cx="0" cy="0" rx={R} ry={R} fill="none" stroke="#F2B66D" strokeWidth="1.6" filter="url(#spGlow)" />
    </svg>
  )
}

function useCountUp(target, run, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run || target == null) return
    if (target <= 0) { setN(0); return }
    let raf = 0
    const s = performance.now()
    const step = (now) => {
      const k = Math.min(1, (now - s) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return n
}

export default function Splash({ streak, statusLine, ready, onDone }) {
  const still = useReducedMotion()
  const [phase, setPhase] = useState(0) // 0 dark, 1 globe, 2 line locks, 3 wordmark + number, 4 leaving
  const doneRef = useRef(false)
  const finish = () => { if (doneRef.current) return; doneRef.current = true; setPhase(4); setTimeout(onDone, still ? 150 : 520) }

  useEffect(() => {
    if (still) { setPhase(3); return }
    const t = [setTimeout(() => setPhase(1), 120), setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 1900)]
    return () => t.forEach(clearTimeout)
  }, [still])

  // Leave once the number has had its moment, or give up waiting on slow data.
  useEffect(() => {
    if (phase !== 3) return
    const wait = ready ? (still ? 1100 : 1700) : 2600
    const t = setTimeout(finish, wait)
    return () => clearTimeout(t)
  }, [phase, ready])

  const count = useCountUp(ready ? streak : null, phase >= 3 && ready, still ? 1 : 950)
  const now = new Date()
  const when = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className={`splash ph-${phase}`} onClick={finish} role="button" tabIndex={0} aria-label="Skip intro"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') finish() }}>
      <Particles still={still} />
      <div className="sp-axis" aria-hidden="true" />
      <div className="sp-stage">
        <Globe phase={phase} still={still} />
        <span className="sp-pulse" aria-hidden="true" />
      </div>
      <div className="sp-copy">
        <h1 className="sp-word">Meridian</h1>
        <p className="sp-coord">{when}<span className="sp-sep" aria-hidden="true" />{tzMeridian()}</p>
        <div className="sp-streak" aria-live="polite">
          {ready ? (
            <>
              <span className="sp-num">{count}</span>
              <span className="sp-unit">{streak === 1 ? 'day kept' : 'days kept'}</span>
            </>
          ) : (
            <span className="sp-sync">Finding your line</span>
          )}
        </div>
        {ready && statusLine ? <p className="sp-status">{statusLine}</p> : null}
      </div>
      <p className="sp-skip">Tap to begin</p>
    </div>
  )
}
