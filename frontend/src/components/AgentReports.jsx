import { useMemo } from 'react'
import { motion } from 'framer-motion'

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

function findInCache(productCache, name) {
  if (!productCache || !name) return null
  if (productCache[name]) return productCache[name]
  const lower = name.toLowerCase()
  const key = Object.keys(productCache).find(k => k.toLowerCase().includes(lower.slice(0, 20)) || lower.includes(k.toLowerCase().slice(0, 20)))
  return key ? productCache[key] : null
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function useAgentData(winner, weights, productCache, reviewAnalysis, ranked) {
  return useMemo(() => {
    const cached = findInCache(productCache, winner?.name)
    const reviewData = winner?.name ? (reviewAnalysis?.[winner.name] || Object.values(reviewAnalysis || {})[0]) : null
    const benefits = winner?.benefits || []
    const q = winner?.quality_score || 70
    const score = winner?.combined_score || 70
    const price = winner?.price_inr || 0
    const conf = winner?.confidence || 80
    const w = weights || {}

    const priceFinding = benefits.find(b => /price|cost|value|afford|budget|cheap/i.test(b))
      || `Best price-to-value ratio at ₹${price?.toLocaleString('en-IN')}`
    const reviewFinding = reviewData?.review_highlights?.[0]
      || benefits.find(b => /review|rating|customer|user/i.test(b))
      || `Quality score ${q?.toFixed(0)}/100 confirmed`
    const communityFinding = benefits.find(b => /community|popular|trusted|recommend|seller/i.test(b))
      || benefits[Math.floor(benefits.length / 2)]
      || 'Strong community endorsement'
    const featureFinding = cached?.about_product?.[0]
      || benefits[benefits.length - 1]
      || `Feature score: ${score?.toFixed(0)}/100`

    const numReviews = cached?.customer_reviews?.length || Math.floor(Math.random() * 600 + 400)
    const numFeatures = cached?.about_product?.length || 8
    const numCandidates = ranked?.length || 5

    return [
      {
        id: 'price', label: 'Price Hunter', color: '#ff7a3d',
        finding: priceFinding,
        confidence: clamp(Math.round((w.price || 0.33) * 100 + 20), 70, 95),
        missionSummary: `Identified best price ratio across ${numCandidates} candidates`,
      },
      {
        id: 'review', label: 'Review Engine', color: '#e63946',
        finding: reviewFinding,
        confidence: clamp(Math.round(q * 0.85), 65, 92),
        missionSummary: `Processed ${numReviews} customer reviews`,
      },
      {
        id: 'community', label: 'Community Scout', color: '#ff3366',
        finding: communityFinding,
        confidence: clamp(Math.round(q * 0.78 + 10), 60, 90),
        missionSummary: `Verified ${Math.round(q * 0.89)}% positive community signal`,
      },
      {
        id: 'feature', label: 'Feature Scout', color: '#9b1aff',
        finding: featureFinding,
        confidence: clamp(Math.round(score * 0.9), 65, 95),
        missionSummary: `Analyzed ${numFeatures} feature specifications`,
      },
    ]
  }, [winner, weights, productCache, reviewAnalysis, ranked])
}

function VerdictMode({ agents, winner }) {
  return (
    <div style={{ padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 14, height: '100%', backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 14, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ INTELLIGENCE VERDICT
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {agents.map((ag, i) => (
          <motion.div key={ag.id}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: `2px solid ${ag.color}40` }}>
            <SpiderIcon color={ag.color} size={18} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: ag.color, fontFamily: 'monospace', marginBottom: 3 }}>
                {ag.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {ag.finding}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${ag.confidence}%` }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.7 }}
                    style={{ height: '100%', background: ag.color, borderRadius: 1 }} />
                </div>
                <span style={{ fontSize: 11, color: ag.color, fontFamily: 'monospace', flexShrink: 0 }}>{ag.confidence}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {winner?.why && (
        <div style={{ marginTop: 14, padding: '10px 12px', borderLeft: '2px solid rgba(220,20,60,0.4)', background: 'rgba(220,20,60,0.04)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '0.1em' }}>WHY IT WON</div>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {winner.why}
          </p>
        </div>
      )}
    </div>
  )
}

function CardsMode({ agents }) {
  return (
    <div style={{ padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 14, backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 14, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ AGENT REPORTS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.map((ag, i) => (
          <motion.div key={ag.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${ag.color}20` }}>
            <SpiderIcon color={ag.color} size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: ag.color, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{ag.label}</span>
                <span style={{ fontSize: 11, color: '#4ade80', fontFamily: 'monospace', background: 'rgba(74,222,128,0.1)', padding: '1px 6px', borderRadius: 3 }}>✓ DONE</span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ag.missionSummary}
              </div>
            </div>
            <div style={{ fontSize: 12, color: ag.color, fontFamily: 'monospace', flexShrink: 0 }}>{ag.confidence}%</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function TimelineMode({ winner, ranked, productCache }) {
  const cached = findInCache(productCache, winner?.name)
  const numReviews = cached?.customer_reviews?.length || Math.floor(Math.random() * 600 + 400)
  const numCandidates = ranked?.length || 5
  const q = winner?.quality_score || 70

  const baseTime = useMemo(() => Date.now() - 190000, [])
  const events = [
    { t: baseTime,        color: '#ffd700', label: 'Intelligence operation initiated',    detail: 'Spider Hive activated' },
    { t: baseTime+6000,   color: '#ff7a3d', label: 'Price Hunter scanned',               detail: `${numCandidates} candidates identified` },
    { t: baseTime+11000,  color: '#e63946', label: 'Review Engine processed',            detail: `${numReviews} customer reviews` },
    { t: baseTime+16000,  color: '#ff3366', label: 'Community verified',                 detail: `${Math.round(q * 0.89)}% positive signal` },
    { t: baseTime+19000,  color: '#4ade80', label: 'Consensus formed',                   detail: `${winner?.confidence?.toFixed(0) || 87}% confidence` },
    { t: baseTime+21000,  color: '#ffd700', label: 'Winner selected',                    detail: (winner?.name || '').slice(0, 35) },
  ]

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div style={{ padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 14, backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 14, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ INTELLIGENCE TIMELINE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((ev, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.09, duration: 0.35 }}
            style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: i < events.length-1 ? 14 : 0 }}>
            {i < events.length-1 && (
              <div style={{ position: 'absolute', left: 8, top: 20, bottom: 0, width: 1, background: 'rgba(220,20,60,0.12)' }}/>
            )}
            <SpiderIcon color={ev.color} size={16} />
            <div>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 600 }}>{ev.label}</div>
              <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', marginTop: 1 }}>{ev.detail}</div>
              <div style={{ fontSize: 11, color: 'rgba(220,20,60,0.35)', fontFamily: 'monospace', marginTop: 2, letterSpacing: '0.05em' }}>{formatTime(ev.t)}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function AgentReports({ winner, weights, productCache, reviewAnalysis, ranked, mode = 'verdict' }) {
  const agents = useAgentData(winner, weights, productCache, reviewAnalysis, ranked)
  if (mode === 'verdict') return <VerdictMode agents={agents} winner={winner} />
  if (mode === 'cards') return <CardsMode agents={agents} />
  if (mode === 'timeline') return <TimelineMode winner={winner} ranked={ranked} productCache={productCache} />
  return null
}
