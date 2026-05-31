import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Search, Loader2, ArrowRight, TrendingDown, Star, BarChart2, Brain, Users, Shield } from 'lucide-react'

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

/* ── Scroll-reactive Spider Orb ─────────────────────────────────── */
function SpiderOrb() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // 0 = section far away, 0.4 = section entering, 0.5 = center, 0.6+ = leaving
  const [phase, setPhase] = useState('idle') // idle | sucking | core | ejecting
  const [spiderPos, setSpiderPos] = useState({ x: 0, y: -120, opacity: 1, scale: 1 })
  const [coreScale, setCoreScale] = useState(1)
  const [legPhase, setLegPhase] = useState(0)
  const legRef = useRef(null)

  useEffect(() => {
    return scrollYProgress.on('change', v => {
      if (v < 0.3) {
        // Spider hangs above orb on silk
        const t = v / 0.3
        setSpiderPos({ x: 0, y: -130 + t * 50, opacity: 1, scale: 1 })
        setCoreScale(1)
        setPhase('idle')
      } else if (v < 0.5) {
        // Sucking in — spider flies toward center
        const t = (v - 0.3) / 0.2
        setSpiderPos({ x: 0, y: -80 + t * 80, opacity: 1 - t * 0.4, scale: 1 - t * 0.5 })
        setCoreScale(1 + t * 0.6)
        setPhase('sucking')
      } else if (v < 0.6) {
        // Spider inside core — orb pulses big
        setSpiderPos({ x: 0, y: 0, opacity: 0, scale: 0 })
        setCoreScale(1.6 - (v - 0.5) * 2)
        setPhase('core')
      } else if (v < 0.8) {
        // Eject — spider shoots out fast downward
        const t = (v - 0.6) / 0.2
        setSpiderPos({ x: t * 80, y: t * 160, opacity: t > 0.3 ? 1 : t / 0.3, scale: 0.5 + t * 0.7 })
        setCoreScale(1)
        setPhase('ejecting')
      } else {
        setSpiderPos({ x: 80, y: 160, opacity: 0, scale: 1 })
        setCoreScale(1)
        setPhase('idle')
      }
    })
  }, [scrollYProgress])

  // Wiggle legs while visible
  useEffect(() => {
    legRef.current = setInterval(() => setLegPhase(p => 1 - p), 300)
    return () => clearInterval(legRef.current)
  }, [])

  const L = legPhase === 0
    ? { tl:'M12 10 L4 4', tr:'M16 10 L24 4', ml:'M12 13 L3 13', mr:'M16 13 L25 13', bl:'M12 16 L4 22', br:'M16 16 L24 22' }
    : { tl:'M12 10 L3 6', tr:'M16 10 L25 6', ml:'M12 13 L2 11', mr:'M16 13 L26 11', bl:'M12 16 L3 20', br:'M16 16 L25 20' }

  // silk thread length from top to spider
  const silkLen = Math.max(0, 130 + spiderPos.y)

  return (
    <div ref={ref} style={{ position: 'relative', width: '320px', height: '320px', margin: '0 auto' }}>

      {/* Silk thread from top */}
      {spiderPos.opacity > 0.1 && (
        <svg style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', overflow: 'visible', pointerEvents: 'none', zIndex: 5 }}
          width="4" height={silkLen}>
          <line x1="2" y1="0" x2="2" y2={silkLen}
            stroke="#e63946" strokeWidth="1" strokeOpacity={spiderPos.opacity * 0.7}
            strokeDasharray="3 3" />
        </svg>
      )}

      {/* Hanging / flying spider */}
      {spiderPos.opacity > 0.05 && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${spiderPos.x}px), calc(-50% + ${spiderPos.y}px)) scale(${spiderPos.scale})`,
          opacity: spiderPos.opacity,
          transition: phase === 'ejecting' ? 'none' : 'transform 0.06s linear, opacity 0.06s linear',
          zIndex: 6,
          filter: 'drop-shadow(0 0 8px rgba(220,20,60,0.9))',
          pointerEvents: 'none',
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
            <circle cx="12.8" cy="8.5" r="0.5" fill="#000"/>
            <circle cx="15.8" cy="8.5" r="0.5" fill="#000"/>
          </svg>
        </div>
      )}

      {/* Outer glow ring — pulses when absorbing */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${coreScale * 0.9})`,
        width: '280px', height: '280px',
        borderRadius: '50%',
        border: `1px solid rgba(220,20,60,${0.08 + (coreScale - 1) * 0.3})`,
        boxShadow: coreScale > 1.2 ? `0 0 ${60 * coreScale}px rgba(220,20,60,0.25)` : 'none',
        transition: 'transform 0.1s, border-color 0.1s',
        zIndex: 1,
      }} />
      {/* Mid ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${coreScale * 0.7})`,
        width: '180px', height: '180px',
        borderRadius: '50%',
        border: `1px solid rgba(220,20,60,${0.15 + (coreScale - 1) * 0.4})`,
        transition: 'transform 0.1s',
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
          boxShadow: `0 0 12px ${['#e63946','#ff8c94','#ff6b75'][i]}`,
          animation: `orbit${i + 1} ${4 + i}s linear infinite`,
          transform: `scale(${coreScale > 1.3 ? 1.5 : 1})`,
          transition: 'transform 0.2s',
          zIndex: 4,
        }} />
      ))}

      {/* Core — blooms red when spider absorbed */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${coreScale})`,
        width: '80px', height: '80px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #ff2040, #8b0000)',
        boxShadow: `0 0 ${40 * coreScale}px rgba(220,20,60,${0.5 + (coreScale - 1) * 0.5}), 0 0 ${80 * coreScale}px rgba(220,20,60,${0.2 + (coreScale-1)*0.3})`,
        animation: 'pulse-glow 2s ease-in-out infinite',
        transition: 'transform 0.1s, box-shadow 0.1s',
        zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Spider symbol inside core when absorbed */}
        {phase === 'core' && (
          <div style={{ opacity: 0.6, filter: 'brightness(10)' }}>
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
function RappelSpider() {
  const [spiderTop, setSpiderTop] = useState(60)
  const [legPhase, setLegPhase] = useState(0)
  const prevScroll = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      // rate: spider travels from nav bottom to viewport bottom over the full page scroll
      const travelDist = window.innerHeight - 72 - 60  // nav bottom → near viewport bottom
      const rate = maxScroll > 0 ? travelDist / maxScroll : 0.2
      setSpiderTop(72 + scrolled * rate)
      if (Math.abs(scrolled - prevScroll.current) > 1) {
        prevScroll.current = scrolled
        setLegPhase(p => 1 - p)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const L = legPhase === 0
    ? { tl:'M12 10 L4 4', tr:'M16 10 L24 4', ml:'M12 13 L3 13', mr:'M16 13 L25 13', bl:'M12 16 L4 22', br:'M16 16 L24 22' }
    : { tl:'M12 10 L3 6', tr:'M16 10 L25 6', ml:'M12 13 L2 11', mr:'M16 13 L26 11', bl:'M12 16 L3 20', br:'M16 16 L25 20' }

  // silk length = distance from top of viewport to spider
  const silkLen = spiderTop

  // thread starts at bottom of nav bar
  const NAV_H = 72
  const threadLen = Math.max(0, silkLen - NAV_H)

  return (
    <div style={{ position: 'fixed', top: NAV_H, right: '7%', zIndex: 9990, pointerEvents: 'none', width: '36px' }}>
      {/* silk thread from bottom of nav down to spider */}
      <svg width="4" height={Math.max(1, threadLen)} style={{ display: 'block', marginLeft: '16px' }}>
        <line x1="2" y1="0" x2="2" y2={threadLen}
          stroke="#e63946" strokeWidth="1.3" strokeOpacity="0.6" strokeDasharray="5 3"/>
      </svg>
      {/* spider at bottom of silk */}
      <div style={{
        filter: 'drop-shadow(0 0 8px rgba(220,20,60,0.9))',
        marginLeft: '2px',
        marginTop: '-2px',
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
      {/* mini web below spider */}
      <svg width="40" height="22" viewBox="0 0 40 22" fill="none" style={{ opacity: 0.4, marginLeft: '-2px' }}>
        <line x1="20" y1="0" x2="2"  y2="22" stroke="#e63946" strokeWidth="0.7"/>
        <line x1="20" y1="0" x2="20" y2="22" stroke="#e63946" strokeWidth="0.7"/>
        <line x1="20" y1="0" x2="38" y2="22" stroke="#e63946" strokeWidth="0.7"/>
        <path d="M6,9 Q20,5 34,9"   fill="none" stroke="#e63946" strokeWidth="0.6"/>
        <path d="M3,16 Q20,11 37,16" fill="none" stroke="#e63946" strokeWidth="0.6"/>
      </svg>
    </div>
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
        {/* Centre faint pulse */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,20,60,0.07) 0%, transparent 65%)',
          animation: 'pulse-glow 4s ease-in-out infinite',
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

      {/* Nav */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        background: 'rgba(8,8,8,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '8px',
            background: 'radial-gradient(circle, #e63946, #8b0000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(220,20,60,0.6)',
          }}>
            <SpiderIcon size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.12em', color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>RONIN</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={onHistoryToggle}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8' }}
          >
            History
          </button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 1 }}
      >
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '160px 24px 120px',
          position: 'relative',
        }}>
          {/* Floating product cards */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <FloatingCard card={FLOATING_CARDS[0]} animClass="animate-float"  style={{ position: 'absolute', top: '14%', left: '4%',  opacity: 0.75 }} />
            <FloatingCard card={FLOATING_CARDS[1]} animClass="animate-float2" style={{ position: 'absolute', top: '18%', right: '16%', opacity: 0.75 }} />
            <FloatingCard card={FLOATING_CARDS[2]} animClass="animate-float"  style={{ position: 'absolute', bottom: '22%', left: '7%', opacity: 0.5 }} />

          </div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(220,20,60,0.1)',
              border: '1px solid rgba(220,20,60,0.3)',
              borderRadius: '100px',
              padding: '6px 16px',
              marginBottom: '28px',
              fontSize: '0.75rem',
              color: '#ff8c94',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e63946', animation: 'pulse-glow 2s infinite' }} />
            🕷 WITH GREAT POWER COMES GREAT SAVINGS
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
              fontWeight: 900,
              lineHeight: 1.0,
              textAlign: 'center',
              marginBottom: '24px',
              maxWidth: '900px',
              fontFamily: 'Space Grotesk, Inter, sans-serif',
            }}
          >
            <span style={{ color: '#fff' }}>Find The Best</span>
            <br />
            <span className="gradient-text">Product In Seconds</span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            style={{
              color: '#64748b',
              fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
              textAlign: 'center',
              maxWidth: '560px',
              lineHeight: 1.7,
              marginBottom: '48px',
            }}
          >
            AI analyzes prices, reviews, specifications and expert opinions to find the perfect product for you — in seconds.
          </motion.p>

          {/* Search box */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: '640px', position: 'relative', zIndex: 2 }}
          >
            <form onSubmit={handleSubmit}>
              <div style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(220,20,60,0.3)',
                borderRadius: '16px',
                padding: '4px',
                boxShadow: '0 0 40px rgba(220,20,60,0.1)',
                transition: 'box-shadow 0.3s, border-color 0.3s',
              }}
              onFocus={() => {}}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                  <Search size={18} style={{ color: '#e63946', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={isLoading}
                    placeholder={typingText || 'Search products or compare...'}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#e2e8f0',
                      fontSize: '1rem',
                      fontFamily: 'Inter, sans-serif',
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #e63946, #e63946)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                      opacity: isLoading || !inputValue.trim() ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 14px rgba(220,20,60,0.4)',
                    }}
                  >
                    {isLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={15} />}
                    {isLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </form>

            {/* Quick pills */}
            {!isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', justifyContent: 'center' }}
              >
                {QUICK_PILLS.map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => { setInputValue(pill); onSearch(pill) }}
                    style={{
                      background: 'rgba(220,20,60,0.07)',
                      border: '1px solid rgba(220,20,60,0.2)',
                      borderRadius: '20px',
                      padding: '6px 14px',
                      color: '#ff6b75',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,20,60,0.15)'; e.currentTarget.style.borderColor = 'rgba(220,20,60,0.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,20,60,0.07)'; e.currentTarget.style.borderColor = 'rgba(220,20,60,0.2)' }}
                  >
                    {pill}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Progress feed */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Loader2 size={13} style={{ color: '#e63946', animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: '#e63946', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Agent Activity
                  </span>
                </div>
                <div ref={progressRef} style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {progress.slice(-8).map((msg, i) => (
                    <div key={i} style={{
                      background: 'rgba(220,20,60,0.05)',
                      border: '1px solid rgba(220,20,60,0.12)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: i === Math.min(progress.length, 8) - 1 ? '#e2e8f0' : '#475569',
                      display: 'flex',
                      gap: '8px',
                    }}>
                      <span style={{ color: '#e63946', fontSize: '0.65rem', marginTop: '3px', flexShrink: 0 }}>▶</span>
                      {msg}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Scroll indicator — spider rappelling down */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}
            >
              <span style={{ color: 'rgba(220,20,60,0.55)', fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                Scroll to Explore
              </span>
              {/* silk thread */}
              <motion.div
                animate={{ scaleY: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: '1.5px', height: '36px', background: 'linear-gradient(to bottom, rgba(220,20,60,0.7), transparent)', transformOrigin: 'top', marginBottom: '-4px' }}
              />
              {/* rappelling spider */}
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ filter: 'drop-shadow(0 0 6px rgba(220,20,60,0.8))' }}
              >
                <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                  <path d="M12 10 L5 5"  stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16 10 L23 5" stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 13 L3 12" stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16 13 L25 12" stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 17 L5 22"  stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16 17 L23 22" stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
                  <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#1a0000" stroke="#e63946" strokeWidth="1"/>
                  <ellipse cx="14" cy="10" rx="2.5" ry="3" fill="#e63946" opacity="0.9"/>
                  <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
                  <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
                  <circle cx="12.8" cy="8.5" r="0.45" fill="#000"/>
                  <circle cx="15.8" cy="8.5" r="0.45" fill="#000"/>
                </svg>
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ── SECTION 1: Features bento ──────────────────────────────────── */}
      <section style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Section>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ color: '#e63946', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
              WHY RONIN
            </p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1 }}>
              Intelligence at every layer
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
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
                    width: '40px', height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(220,20,60,0.12)',
                    border: '1px solid rgba(220,20,60,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px',
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
      <section style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}>
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
