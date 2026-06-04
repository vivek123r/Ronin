import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ProductDNA } from './RadarChart'

function SpiderIcon({ color = '#e63946', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
      <line x1="14" y1="10" x2="4"  y2="3"  stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="24" y2="3"  stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="2"  y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="26" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="4"  y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="24" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#0a0000" stroke={color} strokeWidth="1"/>
      <ellipse cx="14" cy="10" rx="2.5" ry="3" fill={color} opacity="0.9"/>
      <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
      <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
    </svg>
  )
}

function WebPatternSVG() {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return { x: 100 + Math.cos(a)*95, y: 100 + Math.sin(a)*95 }
  })
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.1, pointerEvents: 'none', zIndex: 0 }}>
      {spokes.map((s, i) => <line key={i} x1="100" y1="100" x2={s.x} y2={s.y} stroke="#e63946" strokeWidth="0.8"/>)}
      {[20,40,60,80,95].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#e63946" strokeWidth="0.6"/>)}
    </svg>
  )
}

function ScoreRing({ score }) {
  const r = 36, circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - (score || 0) / 100)), 100)
    return () => clearTimeout(t)
  }, [score, circ])
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e63946" strokeWidth="5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)', filter: 'drop-shadow(0 0 6px rgba(220,20,60,0.7))' }}/>
      <text x="44" y="44" textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize="14" fontWeight="900" fontFamily="Space Grotesk, sans-serif">
        {score?.toFixed(0)}
      </text>
      <text x="44" y="56" textAnchor="middle" fill="rgba(220,20,60,0.6)" fontSize="7" fontFamily="monospace">SCORE</text>
    </svg>
  )
}

function StatChip({ label, value, color, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22,1,0.36,1] }}
      style={{ background: 'rgba(220,20,60,0.07)', border: '1px solid rgba(220,20,60,0.2)', borderRadius: 8, padding: '7px 12px', textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 10, color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: color || '#e2e8f0', fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
    </motion.div>
  )
}

function findInCache(productCache, name) {
  if (!productCache || !name) return null
  if (productCache[name]) return productCache[name]
  const lower = name.toLowerCase()
  const key = Object.keys(productCache).find(k =>
    k.toLowerCase().includes(lower.slice(0, 20)) || lower.includes(k.toLowerCase().slice(0, 20))
  )
  return key ? productCache[key] : Object.values(productCache)[0] || null
}

export default function WinnerCard({ winner, weights, productCache }) {
  const [displayedConf, setDisplayedConf] = useState(0)
  const [showDNA, setShowDNA] = useState(true)
  const cached = findInCache(productCache, winner?.name) || {}
  const imageUrl = winner?.product_image_url || cached?.product_image_url
  const categoryScores = winner?.category_scores || {}
  const hasDNA = Object.keys(categoryScores).length >= 3

  useEffect(() => {
    if (!winner?.confidence) return
    const target = winner.confidence <= 1 ? winner.confidence * 100 : winner.confidence
    const steps = 60, interval = 1500 / steps
    let count = 0
    const timer = setInterval(() => {
      count++
      setDisplayedConf(Math.floor(target * count / steps))
      if (count >= steps) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [winner?.confidence])

  const formatPrice = (p) => p ? `₹${Number(p).toLocaleString('en-IN')}` : '—'
  const avail = winner?.availability?.includes('In Stock') || winner?.availability?.toLowerCase?.().includes('in stock') ? 'IN STOCK' : winner?.availability || '—'

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'rgba(8,0,0,0.7)', border: '1px solid rgba(220,20,60,0.25)', borderRadius: 18, padding: '32px', backdropFilter: 'blur(16px)', boxShadow: '0 0 60px rgba(220,20,60,0.1), inset 0 0 40px rgba(220,20,60,0.03)' }}>

      <WebPatternSVG />

      <div style={{ position: 'absolute', top: 0, right: '10%', width: '40%', height: '100%', background: 'radial-gradient(ellipse at top right, rgba(220,20,60,0.08), transparent 70%)', pointerEvents: 'none', zIndex: 0 }}/>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: image */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.22,1,0.36,1] }}
            style={{ width: 180, height: 180, background: 'rgba(255,255,255,0.96)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 0 30px rgba(220,20,60,0.4), 0 0 60px rgba(220,20,60,0.15)', border: '2px solid rgba(220,20,60,0.3)', position: 'relative', zIndex: 1 }}>
            {imageUrl ? (
              <img src={imageUrl} alt={winner?.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} onError={e => { e.target.style.display = 'none' }}/>
            ) : (
              <div style={{ opacity: 0.3 }}><SpiderIcon color="#e63946" size={60} /></div>
            )}
          </motion.div>
        </div>

        {/* Right: details */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            style={{ fontSize: 11, letterSpacing: '0.3em', color: 'rgba(220,20,60,0.7)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 8 }}>
            ◈ TARGET IDENTIFIED
          </motion.div>

          <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1.2rem,2.5vw,1.9rem)', color: '#fff', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.01em' }}>
            {winner?.name}
          </motion.h2>

          {/* Score ring + confidence counter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
            <ScoreRing score={winner?.combined_score} />
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', marginBottom: 4 }}>CONFIDENCE</div>
              <div style={{ fontSize: 34, fontWeight: 900, fontFamily: 'Space Grotesk, sans-serif', color: '#e63946', lineHeight: 1 }}>
                {displayedConf}<span style={{ fontSize: 18, opacity: 0.7 }}>%</span>
              </div>
            </div>
          </motion.div>

          {/* Stat chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <StatChip label="PRICE" value={formatPrice(winner?.price_inr)} delay={1.1} />
            <StatChip label="QUALITY" value={`${winner?.quality_score?.toFixed(0)}/100`} color="#ff8c94" delay={1.22} />
            <StatChip label="AVAILABILITY" value={avail} color={avail === 'IN STOCK' ? '#4ade80' : '#94a3b8'} delay={1.34} />
          </div>

          {/* Why */}
          {winner?.why && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
              style={{ borderLeft: '2px solid rgba(220,20,60,0.4)', paddingLeft: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 4 }}>DECISION LOGIC</div>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {winner.why}
              </p>
            </motion.div>
          )}

          {/* Buy button */}
          {winner?.url && (
            <motion.a href={winner.url} target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#e63946', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.1em', textDecoration: 'none', boxShadow: '0 0 20px rgba(220,20,60,0.4)' }}>
              <SpiderIcon color="#fff" size={14} /> VIEW ON AMAZON →
            </motion.a>
          )}
        </div>
      </div>

      {/* DNA Profile section */}
      {hasDNA && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.0, duration: 0.5 }}
          style={{ position: 'relative', zIndex: 1, marginTop: 24, padding: '20px 16px', background: 'rgba(220,20,60,0.03)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 12 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace', fontWeight: 700 }}>
              ◈ DNA PROFILE
            </div>
            <button
              onClick={() => setShowDNA(!showDNA)}
              style={{ background: 'rgba(220,20,60,0.08)', border: '1px solid rgba(220,20,60,0.2)', color: '#ff6b75', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer', letterSpacing: '0.06em' }}
            >
              {showDNA ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          {showDNA && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <ProductDNA categoryScores={categoryScores} size={260} />
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )
}
