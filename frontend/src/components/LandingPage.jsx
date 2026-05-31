import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Search, Loader2, ArrowRight, TrendingDown, Star, BarChart2, Brain, Users, Shield } from 'lucide-react'
import SwarmFX from './SwarmFX'

/* Spider-Man SVG logo inline */
function SpiderIcon({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C10.9 2 10 2.9 10 4C10 4.74 10.4 5.38 11 5.73V7H9C7.9 7 7 7.9 7 9V10H5.27C4.64 9.39 3.74 9 2.73 9C1.22 9 0 10.22 0 11.73C0 13.24 1.22 14.46 2.73 14.46C3.74 14.46 4.64 14.07 5.27 13.46H7V15C7 15.55 7.22 16.05 7.59 16.41L5 21H7L9 17H15L17 21H19L16.41 16.41C16.78 16.05 17 15.55 17 15V13.46H18.73C19.36 14.07 20.26 14.46 21.27 14.46C22.78 14.46 24 13.24 24 11.73C24 10.22 22.78 9 21.27 9C20.26 9 19.36 9.39 18.73 10H17V9C17 7.9 16.1 7 15 7H13V5.73C13.6 5.38 14 4.74 14 4C14 2.9 13.1 2 12 2ZM9 9H15V11H9V9ZM9 13H15V15H9V13Z"/>
    </svg>
  )
}

const QUICK_PILLS = [
  'Best earphone under 3000',
  'Gaming laptop under 60000',
  'Compare iPhone 16 vs Samsung S25',
  'Best mechanical keyboard under 5000',
]

const TYPING_QUERIES = [
  'Best wireless earbuds under ₹3,000',
  'Gaming laptop for students',
  'Compare iPhone 16 vs Samsung S25',
  'Best budget phone under ₹15,000',
  'Mechanical keyboard for coding',
]

const FEATURES = [
  { icon: Brain, label: 'AI Analysis', desc: 'Multi-agent reasoning across thousands of data points' },
  { icon: BarChart2, label: 'Price Intel', desc: 'Real-time pricing with budget-aware filtering' },
  { icon: Star, label: 'Review Scan', desc: 'Sentiment analysis from thousands of user reviews' },
  { icon: TrendingDown, label: 'Best Value', desc: 'Weighted scoring to find the perfect price-quality balance' },
  { icon: Users, label: 'Community', desc: 'Insights from Reddit, forums and expert opinions' },
  { icon: Shield, label: 'Unbiased', desc: 'No sponsored results, pure AI-driven recommendations' },
]

const FLOATING_CARDS = [
  { name: 'Sony WH-1000XM5', score: 94, price: '₹28,990', tag: 'Best ANC' },
  { name: 'Apple AirPods Pro', score: 91, price: '₹24,900', tag: 'Premium' },
  { name: 'BoAt Rockerz 550', score: 82, price: '₹1,299', tag: 'Budget Pick' },
]

function useTypingEffect(queries) {
  const [text, setText] = useState('')
  const [queryIdx, setQueryIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = queries[queryIdx]
    const speed = deleting ? 30 : 60
    const timer = setTimeout(() => {
      if (!deleting) {
        if (charIdx < current.length) {
          setText(current.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
        } else {
          setTimeout(() => setDeleting(true), 2000)
        }
      } else {
        if (charIdx > 0) {
          setText(current.slice(0, charIdx - 1))
          setCharIdx(c => c - 1)
        } else {
          setDeleting(false)
          setQueryIdx(i => (i + 1) % queries.length)
        }
      }
    }, speed)
    return () => clearTimeout(timer)
  }, [charIdx, deleting, queryIdx, queries])

  return text
}

function useIntersection(ref) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisible(true)
    }, { threshold: 0.15 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return visible
}

function FloatingCard({ card, style, animClass }) {
  return (
    <div className={animClass} style={{
      ...style,
      background: 'rgba(15,16,32,0.85)',
      border: '1px solid rgba(220,20,60,0.25)',
      borderRadius: '14px',
      padding: '14px 18px',
      backdropFilter: 'blur(20px)',
      minWidth: '200px',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <span style={{ color: '#ff8c94', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {card.tag}
        </span>
        <span style={{
          background: 'rgba(220,20,60,0.15)',
          color: '#ff6b75',
          borderRadius: '6px',
          padding: '1px 7px',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}>{card.score}</span>
      </div>
      <p style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3 }}>{card.name}</p>
      <p style={{ color: '#e63946', fontSize: '0.85rem', fontWeight: 700 }}>{card.price}</p>
    </div>
  )
}

/* shared signal: rappel spider sets this, SpiderOrb reads it */
const orbSignal = { active: false }

/* ── Spider Orb — glows when rappel spider is orbiting ──────────── */
function SpiderOrb() {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => {
      if (orbSignal.active !== active) setActive(orbSignal.active)
    }, 50)
    return () => clearInterval(iv)
  }, [active])

  const glow = active ? 1.6 : 1

  return (
    <div ref={ref} id="orb-ball" style={{ position: 'relative', width: '320px', height: '320px', margin: '0 auto' }}>

      {/* Outer glow ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${glow * 0.9})`,
        width: '280px', height: '280px',
        borderRadius: '50%',
        border: `1px solid rgba(220,20,60,${active ? 0.5 : 0.08})`,
        boxShadow: active ? `0 0 80px rgba(220,20,60,0.35)` : 'none',
        transition: 'transform 0.4s, border-color 0.4s, box-shadow 0.4s',
        zIndex: 1,
      }} />
      {/* Mid ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${glow * 0.7})`,
        width: '180px', height: '180px',
        borderRadius: '50%',
        border: `1px solid rgba(220,20,60,${active ? 0.6 : 0.15})`,
        transition: 'transform 0.4s, border-color 0.4s',
        zIndex: 2,
      }} />

      {/* Orbiting dots */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '9px', height: '9px',
          marginTop: '-4.5px', marginLeft: '-4.5px',
          borderRadius: '50%',
          background: ['#e63946','#ff8c94','#ff6b75'][i],
          boxShadow: `0 0 ${active ? 20 : 12}px ${['#e63946','#ff8c94','#ff6b75'][i]}`,
          animation: `orbit${i + 1} ${4 + i}s linear infinite`,
          transform: `scale(${active ? 1.6 : 1})`,
          transition: 'transform 0.4s, box-shadow 0.4s',
          zIndex: 4,
        }} />
      ))}

      {/* Core — blooms when spider is orbiting */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${glow})`,
        width: '80px', height: '80px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #ff2040, #8b0000)',
        boxShadow: active
          ? `0 0 60px rgba(220,20,60,0.9), 0 0 120px rgba(220,20,60,0.45)`
          : `0 0 40px rgba(220,20,60,0.5), 0 0 80px rgba(220,20,60,0.2)`,
        animation: 'pulse-glow 2s ease-in-out infinite',
        transition: 'transform 0.4s, box-shadow 0.4s',
        zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && (
          <div style={{ opacity: 0.7, filter: 'brightness(10)' }}>
            <SpiderIcon size={28} color="#fff" />
          </div>
        )}
      </div>
    </div>
  )
}

function PriceChart() {
  const prices = [3200, 2800, 3500, 2600, 2900, 2400, 2200, 2100]
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  const range = max - min
  const w = 280, h = 100
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 10) - 5
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>PRICE HISTORY (30 DAYS)</span>
        <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700 }}>↓ ₹1,100 saved</span>
      </div>
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e63946" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e63946" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={pts}
          fill="none"
          stroke="#e63946"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon
          points={`0,${h} ${pts} ${w},${h}`}
          fill="url(#chartGrad)"
        />
      </svg>
    </div>
  )
}

function SentimentViz() {
  const positives = ['Great bass', 'Comfortable fit', 'Long battery', 'Clear highs']
  const negatives = ['Mediocre mic', 'Plasticky build']
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <div style={{ flex: 1 }}>
        {positives.map((t, i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px',
              padding: '6px 12px',
              marginBottom: '6px',
              color: '#4ade80',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            ✓ {t}
          </motion.div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        {negatives.map((t, i) => (
          <motion.div
            key={i}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.2 + 0.4, duration: 0.4 }}
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              padding: '6px 12px',
              marginBottom: '6px',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            ✗ {t}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ── Rappelling spider — fixed to viewport, scroll drives top position ── */
const ORBIT_RADIUS = 155
const NAV_H = 72

function RappelSpider() {
  const s = useRef({
    phase: 'rappel',  // rappel | approach | orbit | eject
    x: window.innerWidth * 0.93,
    y: NAV_H,
    scrollTop: NAV_H,
    // approach
    approachFrames: 0,
    startX: 0, startY: 0,
    // orbit
    angle: 0,
    orbCX: 0,
    orbCY: 0,
    // eject
    vx: 0, vy: 0, scale: 1,
    ejectFrames: 0,
    // legs
    legPhase: 0, lastLeg: 0,
    raf: null,
  })
  const [, setTick] = useState(0)
  const forceRender = () => setTick(n => n + 1)

  function getOrbCenter() {
    const el = document.getElementById('orb-ball')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  function orbIsInRange() {
    const orb = getOrbCenter()
    if (!orb) return false
    // orb is "in range" when its center is within the middle 60% of the viewport
    return orb.y > window.innerHeight * 0.2 && orb.y < window.innerHeight * 0.8
  }

  useEffect(() => {
    const c = s.current

    // ── rAF loop ───────────────────────────────────────────────────────
    function frame(time) {
      c.raf = requestAnimationFrame(frame)

      // leg wiggle
      if (time - c.lastLeg > 200) {
        c.lastLeg = time
        c.legPhase = 1 - c.legPhase
      }

      if (c.phase === 'rappel') {
        const INFLUENCE = 350  // px proximity radius for swarm effect

        // ── normal idle sway: gentle symmetric wave, always present ──────
        const idleWave = Math.sin(time * 0.0018) * 6  // ±6px, ~3.5s cycle

        // ── swarm proximity: how much each zone is influencing ────────────
        // top zone (reverse=true) travels LEFT→RIGHT → pushes spider RIGHT (+1)
        // bot zone (reverse=false) travels RIGHT→LEFT → pushes spider LEFT (−1)
        let swarmPush = 0

        const zoneTop = document.getElementById('swarm-zone-top')
        const zoneBot = document.getElementById('swarm-zone')

        if (zoneTop) {
          const r = zoneTop.getBoundingClientRect()
          const dist = Math.abs(c.y - (r.top + r.height / 2))
          if (dist < INFLUENCE) swarmPush += (1 - dist / INFLUENCE)  // +1 = right
        }
        if (zoneBot) {
          const r = zoneBot.getBoundingClientRect()
          const dist = Math.abs(c.y - (r.top + r.height / 2))
          if (dist < INFLUENCE) swarmPush -= (1 - dist / INFLUENCE)  // -1 = left
        }

        // swarmPush is -1→+1; apply big directional gust when near a zone
        const gust = Math.sin(time * 0.003) * 0.4 + 0.8   // 0.4–1.2 turbulence
        const swarmSway = swarmPush * gust * 55            // up to ±55px when fully in range

        c.x = window.innerWidth * 0.93 + idleWave + swarmSway

      }

      if (c.phase === 'approach' || c.phase === 'orbit') orbSignal.active = true
      else orbSignal.active = false

      if (c.phase === 'approach') {
        // smoothly lerp from start position → orbit entry point (3 o'clock)
        c.approachFrames++
        const orb = getOrbCenter()
        if (orb) { c.orbCX = orb.x; c.orbCY = orb.y }
        const targetX = c.orbCX + ORBIT_RADIUS
        const targetY = c.orbCY
        const t = Math.min(c.approachFrames / 55, 1)  // 55 frames ~0.9s
        // ease-in-out cubic
        const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2
        c.x = c.startX + (targetX - c.startX) * ease
        c.y = c.startY + (targetY - c.startY) * ease
        if (t >= 1) {
          c.angle = 0
          c.phase = 'orbit'
        }

      } else if (c.phase === 'orbit') {
        c.angle += 0.038
        const orb = getOrbCenter()
        if (orb) { c.orbCX = orb.x; c.orbCY = orb.y }
        c.x = c.orbCX + Math.cos(c.angle) * ORBIT_RADIUS
        c.y = c.orbCY + Math.sin(c.angle) * ORBIT_RADIUS

        // eject only when orb fully leaves viewport
        if (!orbIsInRange()) {
          const speed = 18
          c.vx = -Math.sin(c.angle) * speed
          c.vy =  Math.cos(c.angle) * speed
          c.scale = 1
          c.ejectFrames = 0
          c.phase = 'eject'
        }

      } else if (c.phase === 'eject') {
        c.vy += 0.5
        c.x += c.vx
        c.y += c.vy
        c.scale = Math.min(c.scale + 0.018, 1.6)
        c.ejectFrames++

        // off-screen or enough time → snap back to rappel lane
        if (c.x > window.innerWidth + 60 || c.x < -60 ||
            c.y > window.innerHeight + 60 || c.ejectFrames > 90) {
          c.phase = 'rappel'
          c.y = c.scrollTop
          c.scale = 1
        }
      }

      forceRender()
    }

    // ── Scroll handler ─────────────────────────────────────────────────
    const onScroll = () => {
      const scrolled = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const travelDist = window.innerHeight - NAV_H - 60
      const rate = maxScroll > 0 ? travelDist / maxScroll : 0.2
      const newTop = NAV_H + scrolled * rate
      c.scrollTop = newTop

      if (c.phase === 'rappel') {
        // x is driven by wind in rAF — only update y here
        c.y = newTop
        if (Math.abs(scrolled - c.lastLeg) > 10) {
          c.lastLeg = scrolled; c.legPhase = 1 - c.legPhase
        }

        // Pull toward orbit when orb enters viewport
        if (orbIsInRange()) {
          const orb = getOrbCenter()
          if (orb) {
            c.orbCX = orb.x; c.orbCY = orb.y
            c.startX = c.x
            c.startY = c.y
            c.approachFrames = 0
            c.phase = 'approach'
          }
        }
        forceRender()
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // start rAF immediately so wind sway runs even in rappel phase
    c.raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (c.raf) cancelAnimationFrame(c.raf)
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────
  const c = s.current
  const L = c.legPhase === 0
    ? { tl:'M12 10 L4 4', tr:'M16 10 L24 4', ml:'M12 13 L3 13', mr:'M16 13 L25 13', bl:'M12 16 L4 22', br:'M16 16 L24 22' }
    : { tl:'M12 10 L3 6', tr:'M16 10 L25 6', ml:'M12 13 L2 11', mr:'M16 13 L26 11', bl:'M12 16 L3 20', br:'M16 16 L25 20' }

  const threadLen = Math.max(0, c.y - NAV_H)

  // orbit trail arc — last 70°
  function arcPath() {
    const trail = Math.PI * 0.39
    const a0 = c.angle - trail
    const x1 = c.orbCX + Math.cos(a0) * ORBIT_RADIUS
    const y1 = c.orbCY + Math.sin(a0) * ORBIT_RADIUS
    return `M ${x1} ${y1} A ${ORBIT_RADIUS} ${ORBIT_RADIUS} 0 0 1 ${c.x} ${c.y}`
  }

  return (
    <>
      {/* Silk thread (rappel only) — top fixed, bottom follows swayed spider */}
      {c.phase === 'rappel' && (
        <svg style={{ position:'fixed', top:0, left:0, width:'100%', height:'100%', zIndex:9989, pointerEvents:'none' }}>
          <line
            x1={window.innerWidth * 0.93} y1={NAV_H}
            x2={c.x} y2={c.y}
            stroke="#e63946" strokeWidth="1.3" strokeOpacity="0.6" strokeDasharray="5 3"
          />
        </svg>
      )}

      {/* Orbit trail */}
      {c.phase === 'orbit' && c.angle > 0.3 && (
        <svg style={{ position:'fixed', top:0, left:0, width:'100%', height:'100%', zIndex:9989, pointerEvents:'none' }}>
          <path d={arcPath()} fill="none" stroke="#e63946" strokeWidth="1.3" strokeOpacity="0.5" strokeLinecap="round"/>
        </svg>
      )}

      {/* Spider */}
      <div style={{
        position:'fixed', left: c.x - 16, top: c.y - 16,
        zIndex:9990, pointerEvents:'none',
        transform:`scale(${c.scale})`, transformOrigin:'center',
        filter:'drop-shadow(0 0 8px rgba(220,20,60,0.9))',
      }}>
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <path d={L.tl} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
          <path d={L.tr} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
          <path d={L.ml} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
          <path d={L.mr} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
          <path d={L.bl} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
          <path d={L.br} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#1a0000" stroke="#e63946" strokeWidth="1"/>
          <ellipse cx="14" cy="10" rx="2.5" ry="3" fill="#e63946" opacity="0.9"/>
          <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
          <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
          <circle cx="12.8" cy="8.5" r="0.45" fill="#000"/>
          <circle cx="15.8" cy="8.5" r="0.45" fill="#000"/>
        </svg>
      </div>

      {/* Mini web (rappel only) */}
      {c.phase === 'rappel' && (
        <div style={{ position:'fixed', left:c.x - 18, top:c.y + 14, zIndex:9989, pointerEvents:'none' }}>
          <svg width="40" height="22" viewBox="0 0 40 22" fill="none" style={{ opacity:0.38 }}>
            <line x1="20" y1="0" x2="2"  y2="22" stroke="#e63946" strokeWidth="0.7"/>
            <line x1="20" y1="0" x2="20" y2="22" stroke="#e63946" strokeWidth="0.7"/>
            <line x1="20" y1="0" x2="38" y2="22" stroke="#e63946" strokeWidth="0.7"/>
            <path d="M6,9 Q20,5 34,9"    fill="none" stroke="#e63946" strokeWidth="0.6"/>
            <path d="M3,16 Q20,11 37,16" fill="none" stroke="#e63946" strokeWidth="0.6"/>
          </svg>
        </div>
      )}
    </>
  )
}

/* ── Full-viewport animated web network backdrop ─────────────────────── */
function WebNetworkBackground() {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    // Define fixed nodes relative to canvas size (as fractions)
    const NODE_DEFS = [
      // centre-ish cluster
      { fx:0.50, fy:0.45 }, // 0 — core
      // ring 1
      { fx:0.50, fy:0.20 }, // 1
      { fx:0.72, fy:0.32 }, // 2
      { fx:0.72, fy:0.58 }, // 3
      { fx:0.50, fy:0.70 }, // 4
      { fx:0.28, fy:0.58 }, // 5
      { fx:0.28, fy:0.32 }, // 6
      // outer
      { fx:0.50, fy:0.04 }, // 7
      { fx:0.85, fy:0.18 }, // 8
      { fx:0.95, fy:0.50 }, // 9
      { fx:0.85, fy:0.82 }, // 10
      { fx:0.50, fy:0.95 }, // 11
      { fx:0.15, fy:0.82 }, // 12
      { fx:0.05, fy:0.50 }, // 13
      { fx:0.15, fy:0.18 }, // 14
      // extra
      { fx:0.35, fy:0.12 }, // 15
      { fx:0.65, fy:0.12 }, // 16
      { fx:0.90, fy:0.35 }, // 17
      { fx:0.90, fy:0.65 }, // 18
      { fx:0.65, fy:0.88 }, // 19
      { fx:0.35, fy:0.88 }, // 20
      { fx:0.10, fy:0.65 }, // 21
      { fx:0.10, fy:0.35 }, // 22
    ]
    // Edges connecting them — spiderweb pattern
    const EDGES = [
      [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
      [1,2],[2,3],[3,4],[4,5],[5,6],[6,1],
      [1,7],[1,15],[1,16],[2,16],[2,17],[2,8],
      [3,8],[3,9],[3,17],[3,18],[4,18],[4,19],[4,10],
      [5,19],[5,20],[5,21],[4,11],[5,12],
      [6,21],[6,22],[6,14],[6,13],[5,13],
      [7,15],[7,16],[8,17],[9,18],[10,19],[11,20],[12,21],[13,22],[14,15],
      [15,22],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,15],
    ]

    // Travel a pulse along each edge
    let pulses = EDGES.map((e, i) => ({
      edge: e, t: Math.random(), speed: 0.003 + Math.random() * 0.004, active: Math.random() > 0.5,
    }))
    // Randomly activate new pulses
    let lastActivate = 0

    function draw(time) {
      const dt = time - timeRef.current
      timeRef.current = time
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const nodes = NODE_DEFS.map(n => ({ x: n.fx * W, y: n.fy * H }))

      // draw edges
      EDGES.forEach(([a, b]) => {
        ctx.beginPath()
        ctx.moveTo(nodes[a].x, nodes[a].y)
        ctx.lineTo(nodes[b].x, nodes[b].y)
        ctx.strokeStyle = 'rgba(220,20,60,0.12)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      })

      // draw pulses
      pulses.forEach(p => {
        if (!p.active) return
        p.t += p.speed
        if (p.t > 1) { p.t = 0; p.active = false; return }
        const [a, b] = p.edge
        const x = nodes[a].x + (nodes[b].x - nodes[a].x) * p.t
        const y = nodes[a].y + (nodes[b].y - nodes[a].y) * p.t
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6)
        g.addColorStop(0, 'rgba(220,20,60,0.95)')
        g.addColorStop(1, 'rgba(220,20,60,0)')
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
        // bright centre
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fillStyle = '#ff6b75'
        ctx.fill()
      })

      // randomly trigger new pulses
      if (time - lastActivate > 120) {
        lastActivate = time
        const idle = pulses.filter(p => !p.active)
        if (idle.length > 0) {
          idle[Math.floor(Math.random() * idle.length)].active = true
        }
      }

      // draw nodes
      nodes.forEach((n, i) => {
        const isCore = i === 0
        const r = isCore ? 7 : 3.5
        // glow
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4)
        g.addColorStop(0, `rgba(220,20,60,${isCore ? 0.5 : 0.25})`)
        g.addColorStop(1, 'rgba(220,20,60,0)')
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
        // dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isCore ? '#e63946' : 'rgba(220,20,60,0.6)'
        ctx.fill()
      })

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      zIndex: 0, pointerEvents: 'none',
    }} />
  )
}

/* ── Product data node — floats at a web intersection ───────────────── */
function DataNode({ card, animClass, pos, delay }) {
  return (
    <motion.div className={animClass}
      initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
      transition={{ delay, duration:0.5 }}
      style={{ position:'absolute', ...pos }}>
      <div style={{
        background:'rgba(4,0,0,0.88)', border:'1px solid rgba(220,20,60,0.3)',
        borderRadius:'4px', padding:'10px 14px', backdropFilter:'blur(16px)',
        minWidth:'170px', fontFamily:'monospace',
        boxShadow:'0 0 20px rgba(220,20,60,0.1)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
          <span style={{ color:'rgba(220,20,60,0.6)', fontSize:'0.55rem', letterSpacing:'0.15em' }}>{card.tag.toUpperCase()}</span>
          <span style={{ background:'rgba(220,20,60,0.15)', color:'#ff6b75', borderRadius:'2px', padding:'0 5px', fontSize:'0.6rem', fontWeight:800 }}>{card.score}</span>
        </div>
        <p style={{ color:'#e2e8f0', fontSize:'0.75rem', fontWeight:600, marginBottom:'3px', lineHeight:1.3 }}>{card.name}</p>
        <p style={{ color:'#e63946', fontSize:'0.78rem', fontWeight:800 }}>{card.price}</p>
        {/* connection dot */}
        <div style={{ position:'absolute', top:'50%', right:'-5px', transform:'translateY(-50%)', width:'8px', height:'8px', borderRadius:'50%', background:'#e63946', boxShadow:'0 0 8px #e63946' }}/>
      </div>
    </motion.div>
  )
}

/* ── Status node — small data readout at edge of web ────────────────── */
function StatusNode({ label, value, pos, delay }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay }}
      style={{ position:'absolute', ...pos, fontFamily:'monospace', pointerEvents:'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
        <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80', flexShrink:0, animation:'pulse-glow 2s infinite' }}/>
        <div>
          <div style={{ color:'rgba(220,20,60,0.55)', fontSize:'0.5rem', letterSpacing:'0.12em' }}>{label}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.62rem', fontWeight:700 }}>{value}</div>
        </div>
      </div>
    </motion.div>
  )
}

function Section({ children, style, className }) {
  const ref = useRef(null)
  const visible = useIntersection(ref)
  return (
    <div ref={ref} className={`section-reveal${visible ? ' visible' : ''} ${className || ''}`} style={style}>
      {children}
    </div>
  )
}

export default function LandingPage({ onSearch, status, progress, onHistoryToggle }) {
  const [inputValue, setInputValue] = useState('')
  const typingText = useTypingEffect(TYPING_QUERIES)
  const progressRef = useRef(null)
  const isLoading = status === 'loading'
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 600], [0, -120])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight
    }
  }, [progress])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading) return
    onSearch(trimmed)
  }

  return (
    <div style={{ background: '#080808', minHeight: '100vh' }}>
      {/* Rappelling spider — must be outside ALL transformed ancestors so position:fixed works */}
      <RappelSpider />
      {/* Ambient background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Strong top-left red bloom */}
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,20,60,0.22) 0%, rgba(220,20,60,0.08) 40%, transparent 70%)',
        }} />
        {/* Strong bottom-right bloom */}
        <div style={{
          position: 'absolute', bottom: '5%', right: '-8%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(180,10,40,0.18) 0%, rgba(220,20,60,0.06) 45%, transparent 70%)',
        }} />
        {/* Animated web-wave SVG — red lines that are actually visible */}
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '220px', opacity: 0.28 }}
          viewBox="0 0 1440 220" preserveAspectRatio="none">
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e63946" stopOpacity="0"/>
              <stop offset="30%" stopColor="#e63946" stopOpacity="1"/>
              <stop offset="70%" stopColor="#c41230" stopOpacity="1"/>
              <stop offset="100%" stopColor="#e63946" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* Wave 1 */}
          <path d="M0,120 C180,60 360,180 540,120 C720,60 900,180 1080,120 C1260,60 1380,140 1440,120 L1440,220 L0,220 Z"
            fill="none" stroke="url(#waveGrad)" strokeWidth="1.5">
            <animateTransform attributeName="transform" type="translate" values="0,0;-180,0;0,0" dur="8s" repeatCount="indefinite"/>
          </path>
          {/* Wave 2 offset */}
          <path d="M0,150 C200,90 400,170 600,130 C800,90 1000,170 1200,130 C1320,110 1400,150 1440,140 L1440,220 L0,220 Z"
            fill="none" stroke="url(#waveGrad)" strokeWidth="1" strokeOpacity="0.6">
            <animateTransform attributeName="transform" type="translate" values="0,0;120,0;0,0" dur="11s" repeatCount="indefinite"/>
          </path>
          {/* Wave 3 faint fill */}
          <path d="M0,180 C240,140 480,200 720,170 C960,140 1200,200 1440,170 L1440,220 L0,220 Z"
            fill="rgba(220,20,60,0.04)" stroke="url(#waveGrad)" strokeWidth="0.8" strokeOpacity="0.4">
            <animateTransform attributeName="transform" type="translate" values="0,0;-80,0;0,0" dur="14s" repeatCount="indefinite"/>
          </path>
        </svg>
        {/* Scan line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(220,20,60,0.6), transparent)',
          animation: 'scanLine 6s linear infinite',
        }} />
      </div>

      {/* ── NAV — intelligence network terminal bar ─────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '56px',
        background: 'rgba(4,0,0,0.92)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(220,20,60,0.18)',
      }}>
        {/* Left — system ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Spider web logo */}
          <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              {/* web spokes */}
              {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i) => {
                const r = (a*Math.PI)/180
                return <line key={i} x1="18" y1="18" x2={18+Math.cos(r)*16} y2={18+Math.sin(r)*16} stroke="#e63946" strokeWidth="0.8" strokeOpacity="0.7"/>
              })}
              {/* concentric rings */}
              {[5,9,13,16].map(r => <circle key={r} cx="18" cy="18" r={r} fill="none" stroke="#e63946" strokeWidth="0.7" strokeOpacity="0.5"/>)}
              {/* center dot */}
              <circle cx="18" cy="18" r="2.5" fill="#e63946"/>
            </svg>
            {/* pulsing glow */}
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'radial-gradient(circle, rgba(220,20,60,0.3), transparent 70%)', animation:'pulse-glow 2s infinite' }}/>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontFamily:'Space Grotesk, monospace', fontWeight:900, fontSize:'0.95rem', letterSpacing:'0.2em', color:'#fff' }}>WEB</span>
              <span style={{ width:'1px', height:'14px', background:'rgba(220,20,60,0.5)' }}/>
              <span style={{ fontFamily:'Space Grotesk, monospace', fontWeight:900, fontSize:'0.95rem', letterSpacing:'0.2em', color:'#e63946' }}>INTEL</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'1px' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80', animation:'pulse-glow 1.5s infinite' }}/>
              <span style={{ fontFamily:'monospace', fontSize:'0.55rem', color:'rgba(220,20,60,0.6)', letterSpacing:'0.15em' }}>NETWORK ACTIVE • 847 NODES</span>
            </div>
          </div>
        </div>

        {/* Centre — status readout */}
        <div style={{ display:'flex', gap:'24px', alignItems:'center' }}>
          {[['AMAZON','LIVE'],['REVIEWS','12.4K'],['AGENTS','5']].map(([label,val]) => (
            <div key={label} style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'1px' }}>
              <span style={{ fontFamily:'monospace', fontSize:'0.5rem', color:'rgba(220,20,60,0.5)', letterSpacing:'0.12em' }}>{label}</span>
              <span style={{ fontFamily:'monospace', fontSize:'0.7rem', fontWeight:700, color:'#ff6b75' }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Right — controls */}
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button onClick={onHistoryToggle} style={{
            background:'rgba(220,20,60,0.07)', border:'1px solid rgba(220,20,60,0.25)',
            color:'#ff6b75', borderRadius:'6px', padding:'6px 14px',
            fontSize:'0.72rem', fontWeight:700, cursor:'pointer', letterSpacing:'0.08em',
            fontFamily:'monospace', transition:'all 0.2s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(220,20,60,0.18)'; e.currentTarget.style.borderColor='rgba(220,20,60,0.5)' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='rgba(220,20,60,0.07)'; e.currentTarget.style.borderColor='rgba(220,20,60,0.25)' }}
          >
            [ HISTORY ]
          </button>
        </div>
      </nav>

      {/* ── HERO — spider-web intelligence network ─────────────────── */}
      <motion.section style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 1 }}>
        <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', paddingTop: '56px' }}>

          {/* ── Full-viewport web SVG backdrop ── */}
          <WebNetworkBackground />

          {/* ── Data node cards — connected to web ── */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <DataNode card={FLOATING_CARDS[0]} animClass="animate-float"  pos={{ top:'14%', left:'3%' }}  delay={0.8} />
            <DataNode card={FLOATING_CARDS[1]} animClass="animate-float2" pos={{ top:'16%', right:'14%' }} delay={1.0} />
            <DataNode card={FLOATING_CARDS[2]} animClass="animate-float"  pos={{ bottom:'20%', left:'6%' }} delay={1.2} />
            {/* extra nodes — just status dots with labels */}
            <StatusNode label="REDDIT" value="2.1K posts" pos={{ top:'38%', left:'2%' }}  delay={1.4} />
            <StatusNode label="YOUTUBE" value="340 reviews" pos={{ top:'58%', right:'3%' }} delay={1.5} />
            <StatusNode label="AMAZON" value="8.4K results" pos={{ bottom:'32%', right:'12%' }} delay={1.6} />
          </div>

          {/* ── Centre content ── */}
          <div style={{
            position: 'relative', zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', padding: '80px 24px 80px',
          }}>
            {/* System status badge */}
            <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
              style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'28px', fontFamily:'monospace' }}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 8px #4ade80', animation:'pulse-glow 1.5s infinite' }}/>
              <span style={{ color:'rgba(220,20,60,0.7)', fontSize:'0.65rem', letterSpacing:'0.2em' }}>INTELLIGENCE NETWORK ONLINE</span>
              <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'0.65rem' }}>//</span>
              <span style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.65rem', letterSpacing:'0.1em' }}>847 NODES ACTIVE</span>
            </motion.div>

            {/* Main headline */}
            <motion.h1 initial={{ opacity:0, y:32 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.25, duration:0.8, ease:[0.22,1,0.36,1] }}
              style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:900, lineHeight:1.0, textAlign:'center', marginBottom:'8px', maxWidth:'900px' }}>
              <span style={{ display:'block', fontSize:'clamp(0.7rem,1.5vw,1rem)', letterSpacing:'0.35em', color:'rgba(220,20,60,0.6)', fontWeight:700, marginBottom:'12px', fontFamily:'monospace' }}>
                [ WEB INTEL SYSTEM v2.4 ]
              </span>
              <span style={{ display:'block', fontSize:'clamp(2.8rem,7vw,5.8rem)', color:'#fff', lineHeight:1.0 }}>THE WEB</span>
              <span style={{ display:'block', fontSize:'clamp(2.8rem,7vw,5.8rem)', lineHeight:1.0 }} className="gradient-text">KNOWS EVERYTHING</span>
            </motion.h1>

            {/* Sub */}
            <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4, duration:0.6 }}
              style={{ color:'#4a5568', fontSize:'clamp(0.85rem,1.8vw,1rem)', textAlign:'center', maxWidth:'500px', lineHeight:1.8, marginBottom:'44px', fontFamily:'monospace', letterSpacing:'0.02em' }}>
              Spider-web AI crawls prices, reviews &amp; community intelligence<br/>
              <span style={{ color:'rgba(220,20,60,0.5)' }}>——</span> then delivers the single best product for you
            </motion.p>

            {/* Search — styled as terminal input */}
            <motion.div initial={{ opacity:0, y:24, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
              transition={{ delay:0.5, duration:0.6, ease:[0.22,1,0.36,1] }}
              style={{ width:'100%', maxWidth:'620px', position:'relative', zIndex:2 }}>

              <form onSubmit={handleSubmit}>
                <div style={{
                  background:'rgba(4,0,0,0.8)', border:'1px solid rgba(220,20,60,0.4)',
                  borderRadius:'4px', padding:'0',
                  boxShadow:'0 0 0 1px rgba(220,20,60,0.1), 0 0 40px rgba(220,20,60,0.12)',
                  overflow:'hidden',
                }}>
                  {/* terminal top bar */}
                  <div style={{ background:'rgba(220,20,60,0.08)', borderBottom:'1px solid rgba(220,20,60,0.2)', padding:'6px 12px', display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontFamily:'monospace', fontSize:'0.55rem', color:'rgba(220,20,60,0.5)', letterSpacing:'0.15em' }}>SPIDER://SEARCH_QUERY</span>
                    <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:'0.5rem', color:'rgba(220,20,60,0.35)' }}>⬤ LIVE</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px' }}>
                    <span style={{ color:'rgba(220,20,60,0.6)', fontFamily:'monospace', fontSize:'0.85rem', flexShrink:0 }}>›_</span>
                    <input type="text" value={inputValue} onChange={e=>setInputValue(e.target.value)}
                      disabled={isLoading}
                      placeholder={typingText || 'enter search target...'}
                      style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e2e8f0', fontSize:'0.95rem', fontFamily:'monospace', opacity:isLoading?0.6:1, caretColor:'#e63946' }}
                    />
                    <button type="submit" disabled={isLoading||!inputValue.trim()} style={{
                      background: isLoading||!inputValue.trim() ? 'rgba(220,20,60,0.2)' : '#e63946',
                      color:'#fff', border:'none', borderRadius:'3px',
                      padding:'8px 18px', fontSize:'0.78rem', fontWeight:800,
                      cursor: isLoading||!inputValue.trim() ? 'not-allowed':'pointer',
                      display:'flex', alignItems:'center', gap:'6px', whiteSpace:'nowrap',
                      fontFamily:'monospace', letterSpacing:'0.1em', transition:'all 0.2s',
                      boxShadow: isLoading||!inputValue.trim() ? 'none' : '0 0 16px rgba(220,20,60,0.5)',
                    }}>
                      {isLoading ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/> : <span>SCAN</span>}
                      {isLoading ? 'SCANNING...' : '⟶'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Quick pills */}
              {!isLoading && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7 }}
                  style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'12px', justifyContent:'center' }}>
                  {QUICK_PILLS.map(pill => (
                    <button key={pill} type="button" onClick={()=>{ setInputValue(pill); onSearch(pill) }} style={{
                      background:'rgba(220,20,60,0.06)', border:'1px solid rgba(220,20,60,0.2)',
                      borderRadius:'3px', padding:'5px 12px', color:'rgba(220,20,60,0.7)',
                      fontSize:'0.68rem', cursor:'pointer', transition:'all 0.2s',
                      fontFamily:'monospace', letterSpacing:'0.05em',
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,20,60,0.15)';e.currentTarget.style.borderColor='rgba(220,20,60,0.5)';e.currentTarget.style.color='#ff6b75'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(220,20,60,0.06)';e.currentTarget.style.borderColor='rgba(220,20,60,0.2)';e.currentTarget.style.color='rgba(220,20,60,0.7)'}}>
                      {pill}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Progress feed */}
              {isLoading && (
                <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ marginTop:'16px' }}>
                  <div style={{ background:'rgba(4,0,0,0.9)', border:'1px solid rgba(220,20,60,0.25)', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ background:'rgba(220,20,60,0.08)', borderBottom:'1px solid rgba(220,20,60,0.2)', padding:'5px 12px', display:'flex', alignItems:'center', gap:'8px' }}>
                      <Loader2 size={10} style={{ color:'#e63946', animation:'spin 1s linear infinite' }}/>
                      <span style={{ fontFamily:'monospace', fontSize:'0.55rem', color:'rgba(220,20,60,0.6)', letterSpacing:'0.15em' }}>AGENT PIPELINE</span>
                    </div>
                    <div ref={progressRef} style={{ maxHeight:'160px', overflowY:'auto', padding:'8px' }}>
                      {progress.slice(-8).map((msg,i)=>(
                        <div key={i} style={{ display:'flex', gap:'8px', padding:'4px 6px', fontSize:'0.72rem', fontFamily:'monospace', color: i===Math.min(progress.length,8)-1 ? '#ff6b75':'#334155' }}>
                          <span style={{ color:'rgba(220,20,60,0.5)', flexShrink:0 }}>›</span>{msg}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Scroll indicator */}
            {!isLoading && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.6 }}
                style={{ position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', pointerEvents:'none' }}>
                <span style={{ fontFamily:'monospace', color:'rgba(220,20,60,0.4)', fontSize:'0.55rem', letterSpacing:'0.2em', marginBottom:'8px' }}>SCROLL TO EXPLORE</span>
                <motion.div animate={{ y:[0,10,0] }} transition={{ duration:2, repeat:Infinity }}
                  style={{ width:'1.5px', height:'32px', background:'linear-gradient(to bottom, rgba(220,20,60,0.6), transparent)', transformOrigin:'top' }}/>
                <motion.div animate={{ y:[0,10,0] }} transition={{ duration:2, repeat:Infinity }}
                  style={{ filter:'drop-shadow(0 0 5px rgba(220,20,60,0.8))', marginTop:'-3px' }}>
                  <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                    <path d="M12 10 L5 5 M16 10 L23 5 M12 13 L3 12 M16 13 L25 12 M12 17 L5 22 M16 17 L23 22" stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                    <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#1a0000" stroke="#e63946" strokeWidth="1"/>
                    <ellipse cx="14" cy="10" rx="2.5" ry="3" fill="#e63946" opacity="0.9"/>
                    <circle cx="12.5" cy="8.5" r="1" fill="#fff"/><circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
                  </svg>
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.section>

      {/* ── Swarm zone TOP — left to right ──────────────────────────────── */}
      <div id="swarm-zone-top" style={{ height: '280px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <SwarmFX zoneId="swarm-zone-top" reverse={true} />
      </div>

      {/* ── SECTION 1: Features top, web-node swarm below ──────────────── */}
      <section style={{ padding: '0 24px 0', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 11 }}>
        <Section>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <p style={{ color: '#e63946', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
              WHY RONIN
            </p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1 }}>
              Intelligence at every layer
            </h2>
          </div>

          {/* Feature cards — top row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '0' }}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="spotlight-card gradient-border"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    padding: '24px',
                    transition: 'border-color 0.3s, box-shadow 0.3s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(220,20,60,0.3)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(220,20,60,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'rgba(220,20,60,0.12)', border: '1px solid rgba(220,20,60,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
                  }}>
                    <Icon size={18} color="#ff6b75" />
                  </div>
                  <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>{f.label}</h3>
                  <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.6 }}>{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </Section>
      </section>

      {/* ── Swarm zone — spider nodes travel through here ───────────────── */}
      <div id="swarm-zone" style={{ height: '280px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <SwarmFX />
      </div>

      {/* ── SECTION 2: Price Intelligence ─────────────────────────────── */}
      <section style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <Section>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#e63946', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
                PRICE INTELLIGENCE
              </p>
              <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.2, marginBottom: '16px' }}>
                Budget-aware filtering built in
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '24px' }}>
                Say "under ₹3,000" and we filter Amazon results at the API level. Say "around ₹5,000" for ±20% flexibility. Say "between ₹2k and ₹4k" for strict range control.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { q: '"under 3000"', desc: 'Max cap, -20% floor (₹2,400 – ₹3,000)' },
                  { q: '"around 5000"', desc: '±20% range (₹4,000 – ₹6,000)' },
                  { q: '"between 2k and 6k"', desc: 'Strict range enforced' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ background: 'rgba(220,20,60,0.12)', border: '1px solid rgba(220,20,60,0.25)', color: '#ff6b75', borderRadius: '8px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {item.q}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>→ {item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <PriceChart />
              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, background: 'rgba(220,20,60,0.06)', border: '1px solid rgba(220,20,60,0.15)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#e63946', fontSize: '1.2rem', fontWeight: 800 }}>12+</div>
                  <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '2px' }}>Products Compared</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,140,148,0.06)', border: '1px solid rgba(255,140,148,0.15)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#ff8c94', fontSize: '1.2rem', fontWeight: 800 }}>~30s</div>
                  <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '2px' }}>Analysis Time</div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* ── SECTION 3: Review Analysis ────────────────────────────────── */}
      <section style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <Section>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: '14px', letterSpacing: '0.05em' }}>AI REVIEW ANALYSIS</p>
              <SentimentViz />
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Overall Sentiment</span>
                  <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700 }}>86% Positive</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: '86%', height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #4ade80, #22c55e)', boxShadow: '0 0 8px rgba(74,222,128,0.4)' }} />
                </div>
              </div>
            </div>
            <div>
              <p style={{ color: '#e63946', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
                REVIEW INTELLIGENCE
              </p>
              <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.2, marginBottom: '16px' }}>
                Thousands of reviews, distilled to signal
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.7 }}>
                Our review agent scrapes and semantically analyzes customer feedback, surfacing genuine sentiment without the noise. Pros flow left, cons flow right — you see the truth at a glance.
              </p>
            </div>
          </div>
        </Section>
      </section>

      {/* ── SECTION 4: AI Orb ─────────────────────────────────────────── */}
      <section id="orb-section" style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <Section>
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <SpiderOrb />
            <p style={{ color: '#e63946', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px', marginTop: '32px' }}>
              MULTI-AGENT PIPELINE
            </p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1, marginBottom: '16px' }}>
              Multiple AI agents, one perfect answer
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto 32px' }}>
              Intent classifier → Search agent → Review agent → Ranker → Recommendation. Each agent specializes, then collaborates for a consensus that outperforms any single model.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {['Intent Classifier', 'Search Agent', 'Review Agent', 'Ranker', 'Recommender'].map((agent, i) => (
                <span key={i} style={{
                  background: 'rgba(220,20,60,0.08)',
                  border: '1px solid rgba(220,20,60,0.2)',
                  color: '#ff6b75',
                  borderRadius: '20px',
                  padding: '7px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}>
                  {agent}
                </span>
              ))}
            </div>
          </div>
        </Section>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px 120px', position: 'relative', zIndex: 1 }}>
        <Section>
          <div style={{
            maxWidth: '700px',
            margin: '0 auto',
            textAlign: 'center',
            background: 'rgba(220,20,60,0.05)',
            border: '1px solid rgba(220,20,60,0.2)',
            borderRadius: '24px',
            padding: '60px 40px',
          }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1, marginBottom: '14px' }}>
              Ready to find your perfect product?
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.7, marginBottom: '32px' }}>
              No signups. No ads. Just AI-powered research in seconds.
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{
                background: 'linear-gradient(135deg, #e63946, #e63946)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 32px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 24px rgba(220,20,60,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(220,20,60,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(220,20,60,0.4)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <Search size={16} />
              Start Researching
            </button>
          </div>
        </Section>
      </section>
    </div>
  )
}
