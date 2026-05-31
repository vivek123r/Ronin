import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Search, Loader2, Zap, ArrowRight, TrendingDown, Star, BarChart2, Brain, Users, Clock, Shield } from 'lucide-react'

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
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: '14px',
      padding: '14px 18px',
      backdropFilter: 'blur(20px)',
      minWidth: '200px',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <span style={{ color: '#a78bfa', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {card.tag}
        </span>
        <span style={{
          background: 'rgba(99,102,241,0.15)',
          color: '#818cf8',
          borderRadius: '6px',
          padding: '1px 7px',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}>{card.score}</span>
      </div>
      <p style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3 }}>{card.name}</p>
      <p style={{ color: '#6366f1', fontSize: '0.85rem', fontWeight: 700 }}>{card.price}</p>
    </div>
  )
}

function AIOrb() {
  return (
    <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto' }}>
      {/* Core */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80px', height: '80px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #6366f1, #4f46e5)',
        boxShadow: '0 0 60px rgba(99,102,241,0.6), 0 0 120px rgba(99,102,241,0.3)',
        animation: 'pulse-glow 2s ease-in-out infinite',
        zIndex: 3,
      }} />
      {/* Inner ring */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '140px', height: '140px',
        borderRadius: '50%',
        border: '1px solid rgba(99,102,241,0.2)',
        zIndex: 2,
      }} />
      {/* Orbiting dots */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '10px', height: '10px',
          marginTop: '-5px', marginLeft: '-5px',
          borderRadius: '50%',
          background: i === 0 ? '#6366f1' : i === 1 ? '#a78bfa' : '#818cf8',
          boxShadow: `0 0 10px ${i === 0 ? '#6366f1' : i === 1 ? '#a78bfa' : '#818cf8'}`,
          animation: `orbit${i + 1} ${4 + i}s linear infinite`,
          zIndex: 4,
        }} />
      ))}
      {/* Outer glow ring */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '280px', height: '280px',
        borderRadius: '50%',
        border: '1px solid rgba(99,102,241,0.06)',
        zIndex: 1,
      }} />
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
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={pts}
          fill="none"
          stroke="#6366f1"
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
    <div style={{ background: '#03040a', minHeight: '100vh' }}>
      {/* Ambient background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)',
        }} />
        {/* Scan line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)',
          animation: 'scanLine 6s linear infinite',
          opacity: 0.4,
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
        background: 'rgba(3,4,10,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={14} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em', color: '#fff' }}>RONIN</span>
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
          padding: '120px 24px 80px',
          position: 'relative',
        }}>
          {/* Floating product cards */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <FloatingCard card={FLOATING_CARDS[0]} animClass="animate-float" style={{ position: 'absolute', top: '15%', left: '5%', opacity: 0.7 }} />
            <FloatingCard card={FLOATING_CARDS[1]} animClass="animate-float2" style={{ position: 'absolute', top: '20%', right: '5%', opacity: 0.7 }} />
            <FloatingCard card={FLOATING_CARDS[2]} animClass="animate-float" style={{ position: 'absolute', bottom: '20%', left: '8%', opacity: 0.5 }} />
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
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '100px',
              padding: '6px 16px',
              marginBottom: '28px',
              fontSize: '0.75rem',
              color: '#a78bfa',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', animation: 'pulse-glow 2s infinite' }} />
            AI-POWERED PRODUCT INTELLIGENCE
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
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '16px',
                padding: '4px',
                boxShadow: '0 0 40px rgba(99,102,241,0.1)',
                transition: 'box-shadow 0.3s, border-color 0.3s',
              }}
              onFocus={() => {}}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                  <Search size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
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
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
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
                      boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
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
                      background: 'rgba(99,102,241,0.07)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '20px',
                      padding: '6px 14px',
                      color: '#818cf8',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)' }}
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
                  <Loader2 size={13} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: '#6366f1', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Agent Activity
                  </span>
                </div>
                <div ref={progressRef} style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {progress.slice(-8).map((msg, i) => (
                    <div key={i} style={{
                      background: 'rgba(99,102,241,0.05)',
                      border: '1px solid rgba(99,102,241,0.12)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: i === Math.min(progress.length, 8) - 1 ? '#e2e8f0' : '#475569',
                      display: 'flex',
                      gap: '8px',
                    }}>
                      <span style={{ color: '#6366f1', fontSize: '0.65rem', marginTop: '3px', flexShrink: 0 }}>▶</span>
                      {msg}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Scroll indicator */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#334155', fontSize: '0.7rem', letterSpacing: '0.1em' }}
            >
              <span>SCROLL TO EXPLORE</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(99,102,241,0.5), transparent)' }}
              />
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ── SECTION 1: Features bento ──────────────────────────────────── */}
      <section style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Section>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
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
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{
                    width: '40px', height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px',
                  }}>
                    <Icon size={18} color="#818cf8" />
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
              <p style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
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
                    <span style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: '8px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
                <div style={{ flex: 1, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#6366f1', fontSize: '1.2rem', fontWeight: 800 }}>12+</div>
                  <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '2px' }}>Products Compared</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#a78bfa', fontSize: '1.2rem', fontWeight: 800 }}>~30s</div>
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
              <p style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
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
            <AIOrb />
            <p style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px', marginTop: '32px' }}>
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
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  color: '#818cf8',
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
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.2)',
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
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
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
                boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(0)' }}
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
