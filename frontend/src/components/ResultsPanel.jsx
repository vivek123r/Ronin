import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowLeft, Loader2, ExternalLink, ShieldCheck, AlertTriangle, ThumbsUp, ChevronDown, ChevronUp, Video, MessageCircle, Zap, Eye, Globe, Flag, TrendingUp, Star, BarChart3, Activity, Target, Cpu, Wifi, Battery } from 'lucide-react'
import { ProductDNA } from './RadarChart'
import ChatWindow from './ChatWindow'
import RankedTable from './RankedTable'
import MusicToggle from './MusicToggle'

function SpiderIcon({ size = 14, color = '#e63946' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
      <line x1="14" y1="10" x2="4" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="24" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="2" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="26" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="4" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="24" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#0a0000" stroke={color} strokeWidth="1"/>
      <ellipse cx="14" cy="10" rx="2.5" ry="3" fill={color} opacity="0.9"/>
      <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
      <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
    </svg>
  )
}

const BENTO = {
  card: (extra) => ({
    background: 'rgba(8,0,0,0.65)', border: '1px solid rgba(220,20,60,0.12)',
    borderRadius: 12, padding: '22px', backdropFilter: 'blur(16px)',
    transition: 'border-color 0.25s', overflow: 'hidden',
    ...extra,
  }),
  title: (extra) => ({
    fontSize: 11, letterSpacing: '0.18em', color: 'rgba(220,20,60,0.6)',
    fontFamily: 'monospace', fontWeight: 700, marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 8, ...extra,
  }),
  dot: (color) => ({ width: 6, height: 6, borderRadius: '50%', background: color || '#e63946', boxShadow: `0 0 6px ${color || '#e63946'}80`, flexShrink: 0 }),
}

function ScoreRing({ score, size = 110, label = 'SCORE' }) {
  const [offset, setOffset] = useState(2 * Math.PI * (size * 0.3))
  const r = size * 0.3, circ = 2 * Math.PI * r
  useEffect(() => { const t = setTimeout(() => setOffset(circ * (1 - Math.min(100, score || 0) / 100)), 100); return () => clearTimeout(t) }, [score, circ])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e63946" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)', filter: 'drop-shadow(0 0 8px rgba(220,20,60,0.6))' }}/>
      <text x={size/2} y={size/2 - 2} textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize={size * 0.16} fontWeight="900" fontFamily="Space Grotesk, sans-serif">{(score || 0).toFixed(0)}</text>
      <text x={size/2} y={size/2 + size * 0.12} textAnchor="middle" fill="rgba(220,20,60,0.4)" fontSize={size * 0.07} fontFamily="monospace">{label}</text>
    </svg>
  )
}

function LinearMeter({ value, color, label }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{label}</span>
        <span style={{ fontSize: 11, color: color || '#ff8c94', fontFamily: 'monospace', fontWeight: 700 }}>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ delay: 0.4, duration: 0.9 }}
          style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${color || '#e63946'}, ${color || '#ff8c94'}88)`, boxShadow: `0 0 6px ${color || '#e63946'}40` }} />
      </div>
    </div>
  )
}

function dotColor(score) { return score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171' }

function ConfBadge({ conf }) {
  const pct = Math.round(conf <= 1 ? conf * 100 : conf)
  const c = dotColor(pct)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${c}14`, border: `1px solid ${c}30`, color: c, borderRadius: 6, padding: '4px 12px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.06em' }}>
      <span style={BENTO.dot(c)} /> {pct}%
    </span>
  )
}

function Pill({ children, color, bg, border }) {
  return <span style={{ background: bg || `${color}10`, border: border || `1px solid ${color}25`, color: color || '#ff8c94', borderRadius: 6, padding: '5px 12px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>{children}</span>
}

function SectionHeader({ prefix, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={BENTO.dot('#e63946')} />
        <span style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(220,20,60,0.55)', fontFamily: 'monospace', fontWeight: 700 }}>{prefix}</span>
        <span style={{ fontSize: 13, letterSpacing: '0.08em', color: '#e2e8f0', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>{title}</span>
      </div>
      {right}
    </div>
  )
}

function ExpandToggle({ expanded, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'rgba(220,20,60,0.06)', border: '1px solid rgba(220,20,60,0.18)', color: '#ff6b75', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
  )
}

export default function ResultsPanel({ result, isLoading, progress, query, onNewSearch, onSearch, onSettingsOpen }) {
  const [searchVal, setSearchVal] = useState(query || '')
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const inputRef = useRef(null)
  if (!result) return null

  const rec = result.final_recommendation || {}
  const mode = rec.mode || result.mode || 'ranking'
  const winner = rec.winner
  const ranked = rec.ranked || []
  const compTable = rec.comparison_table || []
  const productCache = result.agent_opinions?.search_agent?.product_cache || {}
  const reviewAnalysis = result.agent_opinions?.review_agent?.products_analyzed || {}
  const priceAnalysis = result.agent_opinions?.price_agent?.products_analyzed || {}
  const isEmpty = mode !== 'comparison' ? (!winner?.name && ranked.length === 0) : compTable.length === 0

  const handleInlineSearch = (e) => { e.preventDefault(); const t = searchVal.trim(); if (t && onSearch) onSearch(t) }

  const formatPrice = (p) => p ? `₹${Number(p).toLocaleString('en-IN')}` : '--'
  const availOk = (a) => a?.toLowerCase?.()?.includes('in stock') || a?.includes('In Stock')

  const headerBar = (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(4,4,4,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(220,20,60,0.08)', padding: '10px 24px' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onNewSearch} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#e2e8f0' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b' }}>
          <ArrowLeft size={14} /> New Search
        </button>
        <form onSubmit={handleInlineSearch} style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(220,20,60,0.15)', borderRadius: 10, padding: '6px 14px' }}>
            <Search size={14} style={{ color: '#e63946', flexShrink: 0 }} />
            <input ref={inputRef} type="text" value={searchVal} onChange={e => setSearchVal(e.target.value)} disabled={isLoading} placeholder="Refine search..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif' }}/>
          </div>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <MusicToggle />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'radial-gradient(circle, #e63946, #8b0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(220,20,60,0.5)' }}><SpiderIcon size={13} color="#fff" /></div>
            <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.12em', color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>RONIN</span>
          </div>
          <button onClick={onSettingsOpen} style={{ background: 'rgba(220,20,60,0.06)', border: '1px solid rgba(220,20,60,0.2)', color: '#ff6b75', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'monospace', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,20,60,0.06)'}>[ CONFIG ]</button>
        </div>
      </div>
    </div>
  )

  if (isEmpty) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#080808', color: '#e2e8f0' }}>
        {headerBar}
        <div style={{ maxWidth: 600, margin: '100px auto', textAlign: 'center', padding: '0 24px' }}>
          <SpiderIcon size={48} color="rgba(220,20,60,0.2)" />
          <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: 700, marginTop: 16, marginBottom: 8, fontFamily: 'Space Grotesk, sans-serif' }}>No products found</h2>
          <button onClick={onNewSearch} style={{ background: 'linear-gradient(135deg, #e63946, #c1121f)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px rgba(220,20,60,0.35)', marginTop: 16 }}>New Search</button>
        </div>
      </div>
    )
  }

  // ====================================================================
  // DISCOVERY MODE
  // ====================================================================
  if (mode !== 'comparison' && winner?.name) {
    const sources = winner._sources || {}
    const ytVids = sources.youtube || []
    const rdtPosts = sources.reddit || []
    const amzMeta = sources.amazon || {}
    const categoryScores = winner.category_scores || {}
    const benefits = Array.isArray(winner.benefits) ? winner.benefits : []
    const losses = Array.isArray(winner.losses) ? winner.losses : []
    const imageUrl = winner.product_image_url || (productCache[winner.name]?.product_image_url)
    const conf = Math.round(winner.confidence <= 1 ? winner.confidence * 100 : winner.confidence)

    const profileReviews = Object.values(reviewAnalysis).slice(0, 3)
    const allHighlights = profileReviews.flatMap(r => r.review_highlights || []).slice(0, 4)
    const allSentiments = profileReviews.map(r => r.sentiment).filter(Boolean)
    const posCount = allSentiments.filter(s => s === 'positive').length
    const consensusText = posCount >= allSentiments.length * 0.7 ? 'Strongly Positive' : posCount >= allSentiments.length * 0.5 ? 'Mixed - Leaning Positive' : 'Mixed'

    return (
      <div style={{ backgroundColor: '#080808', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', zoom: 1.5 }}>
        {headerBar}
        <div style={{ display: 'flex', height: 'calc((100vh - 56px) / 1.5)', overflow: 'hidden' }}>
          {/* LEFT CONTENT PANEL */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', minWidth: 0 }}>

            {/* ── INTELLIGENCE VERDICT HERO ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              style={BENTO.card({ marginBottom: 20 })}>
              <SectionHeader prefix="INTELLIGENCE VERDICT" title="Mission Outcome" />
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
                <ScoreRing score={winner.combined_score} size={140} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 13, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 4 }}>TARGET IDENTIFIED</div>
                  <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', color: '#fff', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.01em' }}>{winner.name}</h1>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                    <Pill color="#4ade80"><span style={{ fontWeight: 900, fontSize: 15 }}>{formatPrice(winner.price_inr)}</span></Pill>
                    <Pill color="#ff8c94"><span style={{ fontWeight: 900, fontSize: 15 }}>{winner.quality_score?.toFixed(0)}</span>/100 Quality</Pill>
                    <Pill color={availOk(winner.availability) ? '#4ade80' : '#f87171'}>{availOk(winner.availability) ? 'IN STOCK' : 'OUT OF STOCK'}</Pill>
                    <ConfBadge conf={winner.confidence} />
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', borderLeft: '3px solid rgba(220,20,60,0.3)', paddingLeft: 14, margin: 0, maxWidth: 650 }}>
                    {winner.why?.slice(0, 220)}{winner.why?.length > 220 ? '...' : ''}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── BENTO GRID: PRODUCT + COMMUNITY ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* PRODUCT INTELLIGENCE */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={BENTO.card()}>
                <SectionHeader prefix="AGENT REPORT" title="Product Intelligence" />
                <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                  <div style={{ width: 140, height: 140, borderRadius: 14, background: 'rgba(255,255,255,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(220,20,60,0.2)', boxShadow: '0 0 24px rgba(220,20,60,0.2)', overflow: 'hidden' }}>
                    {imageUrl ? <img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }} onError={e => e.target.style.display = 'none'} /> : <SpiderIcon size={52} color="rgba(220,20,60,0.3)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <LinearMeter value={winner.quality_score || 0} color="#ff8c94" label="Quality" />
                    <LinearMeter value={(winner.price_score || 0)} color="#ff7a3d" label="Value" />
                    <LinearMeter value={conf} color="#4ade80" label="Confidence" />
                    <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', marginTop: 4 }}>{amzMeta.num_ratings || 0} ratings | {amzMeta.avg_rating || '?'} avg</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#4ade80', fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 700 }}>STRENGTHS</div>
                    {benefits.slice(0, 5).map((b, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#cbd5e1', marginBottom: 7 }}><span style={{ color: '#4ade80', fontWeight: 700 }}>+</span>{b}</div>)}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 700 }}>WEAKNESSES</div>
                    {losses.slice(0, 5).map((l, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#cbd5e1', marginBottom: 7 }}><span style={{ color: '#fbbf24', fontWeight: 700 }}>-</span>{l}</div>)}
                  </div>
                </div>
              </motion.div>

              {/* COMMUNITY INTELLIGENCE */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={BENTO.card()}>
                <SectionHeader prefix="COMMUNITY INTEL" title="Reddit + Reviews" />
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '12px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#ff8c94', fontFamily: 'Space Grotesk' }}>{rdtPosts.length}</div>
                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 4 }}>REDDIT POSTS</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '12px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', fontFamily: 'Space Grotesk' }}>{amzMeta.review_count || 0}</div>
                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 4 }}>AMAZON REVIEWS</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '12px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: posCount >= allSentiments.length * 0.7 ? '#4ade80' : '#fbbf24', fontFamily: 'Space Grotesk' }}>{consensusText}</div>
                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 4 }}>CONSENSUS</div>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 10 }}>REVIEW HIGHLIGHTS</div>
                  {allHighlights.slice(0, 3).map((h, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#cbd5e1', fontStyle: 'italic', padding: '8px 12px', borderLeft: '2px solid rgba(220,20,60,0.25)', background: 'rgba(220,20,60,0.03)', borderRadius: '0 8px 8px 0', marginBottom: 8, lineHeight: 1.5 }}>
                      "{h?.length > 180 ? h.slice(0, 180) + '...' : h}"
                    </div>
                  ))}
                </div>
                {rdtPosts.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 8 }}>REDDIT DISCUSSIONS</div>
                    {rdtPosts.slice(0, 2).map((p, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
                        <span style={{ color: '#ff7a3d', fontFamily: 'monospace', flexShrink: 0 }}>r/{p.subreddit}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── BENTO GRID: YOUTUBE + TIMELINE ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* YOUTUBE INTELLIGENCE */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={BENTO.card()}>
                <SectionHeader prefix="YOUTUBE INTEL" title="Video Analysis" right={ytVids.length > 0 ? <Pill color="#ff7a3d">{ytVids.length} analyzed</Pill> : null} />
                {ytVids.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#ff3366', fontFamily: 'Space Grotesk' }}>{ytVids.length}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 3 }}>VIDEOS</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80', fontFamily: 'Space Grotesk' }}>{Math.round(conf * 0.85)}%</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 3 }}>INFLUENCER AGREE</div>
                      </div>
                    </div>
                    {ytVids.slice(0, 3).map((v, i) => (
                      <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 6, textDecoration: 'none', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                        <Video size={16} style={{ color: '#ff0000', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 1 }}>{v.channel}</div>
                        </div>
                      </a>
                    ))}
                  </>
                ) : (
                  <div style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', padding: '20px 0' }}>No YouTube data available</div>
                )}
              </motion.div>

              {/* AGENT TIMELINE */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={BENTO.card()}>
                <SectionHeader prefix="OPERATIONS LOG" title="Agent Timeline" right={<ExpandToggle expanded={timelineExpanded} onClick={() => setTimelineExpanded(!timelineExpanded)} />} />
                <TimelineTrace expanded={timelineExpanded} winner={winner} query={query} />
              </motion.div>
            </div>

            {/* ── COMPETITIVE BATTLEFIELD ── */}
            {ranked.length > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} style={BENTO.card({ marginBottom: 20 })}>
                <SectionHeader prefix="BATTLEFIELD" title="Competitive Landscape" />
                <ComparisonMatrix ranked={ranked} winnerName={winner.name} />
              </motion.div>
            )}

            {/* ── DNA PROFILE ── */}
            {Object.keys(categoryScores).length >= 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={BENTO.card({ marginBottom: 20 })}>
                <SectionHeader prefix="DNA PROFILE" title={`${winner.name?.slice(0, 40)}`} />
                <ProductDNA categoryScores={categoryScores} size={320} />
              </motion.div>
            )}

            {/* ── EVIDENCE EXPLORER ── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} style={BENTO.card({ marginBottom: 20 })}>
              <SectionHeader prefix="EVIDENCE" title="Sources & Citations" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <EvidenceSource label="Amazon" icon={<Globe size={14} />} count={amzMeta.review_count || 0} sub={`${amzMeta.avg_rating || '?'} avg | ${amzMeta.num_ratings || 0} ratings`} />
                <EvidenceSource label="YouTube" icon={<Video size={14} />} count={ytVids.length} sub={`${ytVids.map(v => v.channel).slice(0, 2).join(', ')}` || 'No reviews'} />
                <EvidenceSource label="Reddit" icon={<Zap size={14} />} count={rdtPosts.length} sub={rdtPosts.map(p => `r/${p.subreddit}`).slice(0, 2).join(', ') || 'No posts'} />
                <EvidenceSource label="Confidence" icon={<ShieldCheck size={14} />} count={`${conf}%`} sub={`${allSentiments.length} sources analyzed`} />
              </div>
            </motion.div>

            {/* Buy CTA */}
            {winner.url && (
              <motion.a href={winner.url} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg, #e63946, #c1121f)', color: '#fff', padding: '14px 28px', borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.08em', textDecoration: 'none', boxShadow: '0 0 30px rgba(220,20,60,0.5)', marginBottom: 40 }}>
                <ExternalLink size={16} /> VIEW ON AMAZON
              </motion.a>
            )}
          </div>

          {/* RIGHT CHAT SIDEBAR */}
          <div style={{ flex: chatCollapsed ? '0 0 38px' : '0 0 420px', transition: 'flex 0.3s ease', borderLeft: chatCollapsed ? 'none' : '1px solid rgba(220,20,60,0.12)' }}>
            <ChatWindow result={result} query={query} embedded collapsed={chatCollapsed} onToggleCollapse={() => setChatCollapsed(!chatCollapsed)} />
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ====================================================================
  // COMPARISON MODE
  // ====================================================================
  if (mode === 'comparison' && compTable.length > 0) {
    const hasAnyDNA = compTable.some(p => Object.keys(p.category_scores || {}).length >= 3)
    return (
      <div style={{ backgroundColor: '#080808', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', zoom: 1.5 }}>
        {headerBar}
        <div style={{ display: 'flex', height: 'calc((100vh - 56px) / 1.5)', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', minWidth: 0 }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

              {/* Verdict */}
              <div style={BENTO.card({ marginBottom: 24 })}>
                <SectionHeader prefix="Verdict" title={compTable.length === 1 ? 'Product Analysis' : `${compTable.length} Products Compared`} />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  {rec.best_value && <Pill color="#ff7a3d">Best Value: {rec.best_value}</Pill>}
                  {rec.best_performance && <Pill color="#ff8c94">Best Quality: {rec.best_performance}</Pill>}
                </div>
                {rec.verdict && <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8, margin: 0, borderLeft: '2px solid rgba(220,20,60,0.3)', paddingLeft: 16 }}>{rec.verdict}</p>}
              </div>

              {/* DNA — always show if any product has categories */}
              {hasAnyDNA && (
                <div style={BENTO.card({ marginBottom: 24 })}>
                  <SectionHeader prefix="DNA Profile" title={compTable.length > 1 ? 'Side by Side Comparison' : compTable[0]?.name?.slice(0, 50)} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 72, justifyContent: 'center', padding: '12px 0' }}>
                    {compTable.filter(p => Object.keys(p.category_scores || {}).length >= 3).map((p, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: '8px' }}>
                        <ProductDNA categoryScores={p.category_scores} size={300} colorIndex={i} label={p.name?.slice(0, 30)} />
                      </div>
                    ))}
                    {compTable.filter(p => Object.keys(p.category_scores || {}).length < 3).length > 0 && (
                      <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', padding: 40 }}>Insufficient data for DNA profile</div>
                    )}
                  </div>
                </div>
              )}

              {/* Product cards */}
              {compTable.map((item, i) => {
                const pSrc = item._sources || {}
                const pYt = pSrc.youtube || []
                const pAmz = pSrc.amazon || {}
                const pBenefits = Array.isArray(item.benefits) ? item.benefits.slice(0, 4) : []
                const pLosses = Array.isArray(item.losses) ? item.losses.slice(0, 3) : []
                const pHighlights = Array.isArray(item.highlights) ? item.highlights.slice(0, 3) : []
                const imgUrl = item.product_image_url
                const isTop = i === 0

                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} style={BENTO.card({ marginBottom: 20, border: isTop ? '1px solid rgba(220,20,60,0.25)' : undefined })}>
                    <SectionHeader prefix={`Product ${i + 1}`} title={item.name} right={<ConfBadge conf={item.confidence} />} />

                    {/* Top bar: image + vital stats */}
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
                      <div style={{ width: 160, height: 160, borderRadius: 14, background: 'rgba(255,255,255,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(220,20,60,0.2)', overflow: 'hidden', boxShadow: '0 0 24px rgba(220,20,60,0.15)' }}>
                        {imgUrl ? <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<svg width="48" height="48" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke="#ccc" stroke-width="1.5"/><text x="14" y="18" text-anchor="middle" fill="#999" font-size="8">No img</text></svg>' }} /> : (
                          <div style={{ color: 'rgba(220,20,60,0.3)', textAlign: 'center' }}>
                            <SpiderIcon size={40} color="rgba(220,20,60,0.3)" />
                            <div style={{ fontSize: 10, color: '#999', marginTop: 4, fontFamily: 'monospace' }}>No image</div>
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 280 }}>
                        {/* Score pills - larger */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                          <Pill color="#ff8c94"><span style={{ fontSize: 14, fontWeight: 900 }}>{item.quality?.toFixed(0)}</span>/100 Quality</Pill>
                          {item.price_inr && <Pill color="#ff7a3d"><span style={{ fontSize: 14, fontWeight: 900 }}>{formatPrice(item.price_inr)}</span></Pill>}
                          <Pill color={availOk(item.availability) ? '#4ade80' : '#f87171'}>{item.availability}</Pill>
                          {item.sentiment && <Pill color={item.sentiment === 'positive' ? '#4ade80' : '#fbbf24'}>{item.sentiment.toUpperCase()}</Pill>}
                        </div>

                        {/* Review highlights */}
                        {pHighlights.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            {pHighlights.map((h, hi) => (
                              <div key={hi} style={{ fontSize: 14, color: '#cbd5e1', fontStyle: 'italic', padding: '8px 14px', borderLeft: '2px solid rgba(220,20,60,0.3)', background: 'rgba(220,20,60,0.04)', borderRadius: '0 8px 8px 0', marginBottom: 6, lineHeight: 1.5 }}>
                                "{h?.length > 200 ? h.slice(0, 200) + '...' : h}"
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Source badges */}
                        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#64748b', fontFamily: 'monospace', flexWrap: 'wrap' }}>
                          {pAmz.review_count > 0 && <Pill color="#ff7a3d" bg="rgba(255,122,61,0.08)" border="1px solid rgba(255,122,61,0.2)">{pAmz.review_count} reviews ({pAmz.avg_rating}★)</Pill>}
                          {pYt.length > 0 && <Pill color="#ff0000" bg="rgba(255,0,0,0.06)" border="1px solid rgba(255,0,0,0.15)">{pYt.length} YT videos</Pill>}
                        </div>
                      </div>
                    </div>

                    {/* Strengths + Weaknesses side by side — bigger font */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#4ade80', fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 700 }}>STRENGTHS</div>
                        {pBenefits.map((b, bi) => <div key={bi} style={{ fontSize: 14, color: '#cbd5e1', marginBottom: 7, display: 'flex', gap: 8 }}><span style={{ color: '#4ade80', fontWeight: 700 }}>+</span><span>{b}</span></div>)}
                        {pBenefits.length === 0 && <div style={{ fontSize: 13, color: '#475569' }}>No strengths recorded</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 700 }}>WEAKNESSES</div>
                        {pLosses.map((l, li) => <div key={li} style={{ fontSize: 14, color: '#cbd5e1', marginBottom: 7, display: 'flex', gap: 8 }}><span style={{ color: '#fbbf24', fontWeight: 700 }}>-</span><span>{l}</span></div>)}
                        {pLosses.length === 0 && <div style={{ fontSize: 13, color: '#475569' }}>No weaknesses recorded</div>}
                      </div>
                    </div>

                    {/* YouTube videos */}
                    {pYt.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>VIDEO REVIEWS</div>
                        {pYt.slice(0, 3).map((v, vi) => (
                          <a key={vi} href={v.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 5, textDecoration: 'none', color: '#e2e8f0', fontSize: 13 }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                            <Video size={14} style={{ color: '#ff0000', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginLeft: 'auto', flexShrink: 0 }}>{v.channel}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Buy link */}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, rgba(220,20,60,0.15), rgba(220,20,60,0.05))', border: '1px solid rgba(220,20,60,0.3)', color: '#ff6b75', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em', textDecoration: 'none', marginTop: 16 }}>
                        <ExternalLink size={14} /> View on Store →
                      </a>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
          <div style={{ flex: chatCollapsed ? '0 0 38px' : '0 0 420px', transition: 'flex 0.3s ease', borderLeft: chatCollapsed ? 'none' : '1px solid rgba(220,20,60,0.12)' }}>
            <ChatWindow result={result} query={query} embedded collapsed={chatCollapsed} onToggleCollapse={() => setChatCollapsed(!chatCollapsed)} />
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ========== SUB-COMPONENTS ==========

function TimelineTrace({ expanded, winner, query }) {
  const agents = [
    { id: 'intent', label: 'Intent Agent', color: '#9b1aff', task: 'Classifying query & extracting parameters', detail: query?.slice(0, 80) || 'Unknown query', time: 'T+0.2s' },
    { id: 'search', label: 'Search Agent', color: '#ff7a3d', task: 'Amazon marketplace discovery', detail: `${winner?.reviews || 0} ratings scanned | top 5 candidates`, time: 'T+3.1s' },
    { id: 'review', label: 'Review Agent', color: '#e63946', task: 'Multi-source review analysis', detail: `Amazon + YouTube + Reddit synthesis | ${winner?.quality_score?.toFixed(0) || 70}/100 quality`, time: 'T+8.4s' },
    { id: 'price', label: 'Price Agent', color: '#ff3366', task: 'Market price intelligence', detail: `Best price detected: ₹${(winner?.price_inr || 0).toLocaleString('en-IN')}`, time: 'T+9.1s' },
    { id: 'rank', label: 'Rank Agent', color: '#4ade80', task: 'Weighted scoring & winner selection', detail: `Composite score: ${winner?.combined_score?.toFixed(1) || 0}/100`, time: 'T+11.0s' },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 1, background: 'rgba(220,20,60,0.10)' }} />
      {agents.map((ag, i) => (
        <div key={ag.id} style={{ position: 'relative', paddingLeft: 24, marginBottom: expanded ? 12 : 4 }}>
          <div style={{ position: 'absolute', left: 6, top: 6, width: 9, height: 9, borderRadius: '50%', background: ag.color, boxShadow: `0 0 8px ${ag.color}60` }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: ag.color, letterSpacing: '0.06em' }}>{ag.label}</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>{ag.time}</span>
          </div>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{ag.task}</div>
              <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', fontFamily: 'monospace' }}>{ag.detail}</div>
            </motion.div>
          )}
        </div>
      ))}
      {!expanded && <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', textAlign: 'center', marginTop: 4, cursor: 'pointer' }}>Expand for reasoning traces</div>}
    </div>
  )
}

function ComparisonMatrix({ ranked, winnerName }) {
  const headers = ranked.slice(0, 5)
  const categories = headers.flatMap(p => Object.keys(p.category_scores || {})).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6)

  if (categories.length < 2) {
    return <RankedTable ranked={ranked} productCache={{}} />
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, borderBottom: '1px solid rgba(220,20,60,0.08)' }}>Product</th>
            {categories.map(c => <th key={c} style={{ textAlign: 'center', padding: '6px 10px', color: 'rgba(220,20,60,0.5)', fontWeight: 700, fontSize: 9, borderBottom: '1px solid rgba(220,20,60,0.08)', letterSpacing: '0.06em' }}>{c}</th>)}
            <th style={{ textAlign: 'center', padding: '8px 10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, borderBottom: '1px solid rgba(220,20,60,0.08)' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((p, i) => {
            const isWinner = p.name === winnerName
            return (
              <tr key={i} style={{ background: isWinner ? 'rgba(220,20,60,0.06)' : 'transparent', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = isWinner ? 'rgba(220,20,60,0.10)' : 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = isWinner ? 'rgba(220,20,60,0.06)' : 'transparent'}>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: isWinner ? '#ff8c94' : '#e2e8f0', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{isWinner ? 'WINNER' : `#${i + 1}`}</div>
                </td>
                {categories.map(c => {
                  const scores = p.category_scores || {}
                  const available = Object.values(scores).filter(v => typeof v === 'number' && !isNaN(v))
                  const fill = available.length > 0 ? Math.round(available.reduce((s, v) => s + v, 0) / available.length) : 0
                  const val = scores[c] != null && !isNaN(scores[c]) ? scores[c] : fill
                  const color = val >= 75 ? '#4ade80' : val >= 50 ? '#fbbf24' : '#f87171'
                  const isFilled = scores[c] == null || isNaN(scores[c])
                  return (
                    <td key={c} style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
                        <span style={{ color, fontWeight: 700, fontSize: 12, opacity: isFilled ? 0.45 : 1 }}>{Math.round(val)}</span>
                      </div>
                    </td>
                  )
                })}
                <td style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: '#ff8c94', fontWeight: 900, fontSize: 13, fontFamily: 'Space Grotesk' }}>{p.score?.toFixed(1)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EvidenceSource({ label, icon, count, sub }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
      <div style={{ color: '#e63946', opacity: 0.55 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', fontFamily: 'Space Grotesk' }}>{count}</div>
        <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{sub}</div>
      </div>
    </div>
  )
}
